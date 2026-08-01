const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

/**
 * Reads the text and the pictures out of a PDF, page by page.
 *
 * Indexing used to keep text alone, so a recipe's photos were dropped at upload
 * and an answer could only ever mention them. Pages are tracked alongside the
 * text so an answer can show the pictures from the pages it actually drew on,
 * rather than everything in the file.
 */

/**
 * Ships with pdfjs, which warns on every document without it.
 *
 * Read off disk rather than as a file:// URL: pdfjs fetches the URL form, and
 * Node's fetch refuses that scheme. Separators are normalized because pdfjs
 * requires a trailing slash and a Windows path does not end in one.
 */
const STANDARD_FONTS = `${path
    .join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts')
    .replace(/\\/g, '/')}/`;

/** Below this an image is a bullet, rule, or logo rather than a picture. */
const MIN_IMAGE_EDGE = 120;
const MIN_IMAGE_PIXELS = 40_000;

/** Bounds the work and the storage one upload can cause. */
const MAX_IMAGES_PER_DOCUMENT = Math.max(0, parseInt(process.env.AI_RAG_MAX_IMAGES || '24', 10));

/** Downscaled before storage; these are shown as thumbnails and in a lightbox. */
const MAX_IMAGE_EDGE = 1400;

let pdfjsPromise;

/** pdfjs is ESM only, so it is imported once and reused. */
function loadPdfjs() {
    if (!pdfjsPromise) {
        pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
    }
    return pdfjsPromise;
}

/**
 * pdf.js hands back plain pixels, having already undone whatever compression the
 * PDF used. Reading the raw streams instead would mean reimplementing every
 * encoding a PDF is allowed to contain.
 */
async function encodeImage(img) {
    const { width, height } = img;
    const source = img.data;
    if (!source || !width || !height) return null;

    const raw = Buffer.isBuffer(source) ? source : Buffer.from(source);
    if (!raw.length) return null;

    const channels = Math.round(raw.length / (width * height));
    if (![1, 3, 4].includes(channels)) return null;

    // JPEG keeps these small, which matters because they are served on every
    // answer that cites the page.
    const buffer = await sharp(raw, { raw: { width, height, channels } })
        .resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: 82 })
        .toBuffer();

    return { buffer, width, height, contentType: 'image/jpeg' };
}

function isWorthKeeping(img) {
    if (!img || !img.width || !img.height) return false;
    if (img.width < MIN_IMAGE_EDGE && img.height < MIN_IMAGE_EDGE) return false;
    return img.width * img.height >= MIN_IMAGE_PIXELS;
}

/** Resolves an image object, which may be page-scoped or shared between pages. */
function readImageObject(page, doc, name) {
    return new Promise((resolve) => {
        try {
            page.objs.get(name, (value) => resolve(value));
        } catch (err) {
            try {
                resolve(doc.commonObjs.get(name));
            } catch (err2) {
                resolve(null);
            }
        }
    });
}

async function extractPageImages(pdfjs, doc, page, pageNo, seen, collected) {
    let ops;
    try {
        ops = await page.getOperatorList();
    } catch (err) {
        console.warn(`[PDF] page ${pageNo}: could not read drawing operations —`, err.message);
        return;
    }

    for (let i = 0; i < ops.fnArray.length; i += 1) {
        if (collected.length >= MAX_IMAGES_PER_DOCUMENT) return;

        const op = ops.fnArray[i];
        if (op !== pdfjs.OPS.paintImageXObject && op !== pdfjs.OPS.paintJpegXObject) continue;

        const name = ops.argsArray[i][0];
        let img;
        try {
            img = await readImageObject(page, doc, name);
        } catch (err) {
            continue;
        }
        if (!isWorthKeeping(img)) continue;

        let encoded;
        try {
            encoded = await encodeImage(img);
        } catch (err) {
            console.warn(`[PDF] page ${pageNo}: could not encode ${name} —`, err.message);
            continue;
        }
        if (!encoded) continue;

        // A logo repeated on every page would otherwise be stored many times and
        // shown beside answers it has nothing to do with.
        const fingerprint = crypto.createHash('sha1').update(encoded.buffer).digest('hex');
        if (seen.has(fingerprint)) continue;
        seen.set(fingerprint, true);

        collected.push({ page: pageNo, ...encoded });
    }
}

/**
 * @returns {Promise<{ pages: Array<{page: number, text: string}>, images: Array<{page: number, buffer: Buffer, width: number, height: number, contentType: string}>, truncatedImages: boolean }>}
 */
async function extractPdfContent(buffer) {
    const pdfjs = await loadPdfjs();
    const doc = await pdfjs.getDocument({
        data: new Uint8Array(buffer),
        standardFontDataUrl: STANDARD_FONTS,
        // There is no DOM here, and eval is not something to hand a user upload.
        disableFontFace: true,
        isEvalSupported: false
    }).promise;

    const pages = [];
    const images = [];
    const seen = new Map();

    try {
        for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
            const page = await doc.getPage(pageNo);

            try {
                const content = await page.getTextContent();
                const text = content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim();
                pages.push({ page: pageNo, text });
            } catch (err) {
                console.warn(`[PDF] page ${pageNo}: could not read text —`, err.message);
                pages.push({ page: pageNo, text: '' });
            }

            if (MAX_IMAGES_PER_DOCUMENT > 0 && images.length < MAX_IMAGES_PER_DOCUMENT) {
                await extractPageImages(pdfjs, doc, page, pageNo, seen, images);
            }

            page.cleanup();
        }
    } finally {
        await doc.destroy();
    }

    return {
        pages,
        images,
        truncatedImages: images.length >= MAX_IMAGES_PER_DOCUMENT
    };
}

module.exports = {
    extractPdfContent,
    MAX_IMAGES_PER_DOCUMENT
};
