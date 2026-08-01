const crypto = require('crypto');
const sharp = require('sharp');

/**
 * Shared rules for pictures taken out of an uploaded document.
 *
 * PDFs and Word files are read by different libraries and hand back images in
 * different shapes — raw pixels in one case, an encoded file in the other — but
 * what counts as a picture worth keeping, and the form it is stored in, should
 * not depend on which format it arrived in.
 */

/** Below this an image is a bullet, rule, or logo rather than a picture. */
const MIN_IMAGE_EDGE = 120;
const MIN_IMAGE_PIXELS = 40_000;

/** Bounds the work and the storage one upload can cause. */
const MAX_IMAGES_PER_DOCUMENT = Math.max(0, parseInt(process.env.AI_RAG_MAX_IMAGES || '24', 10));

/** Downscaled before storage; these are shown as thumbnails and in a lightbox. */
const MAX_IMAGE_EDGE = 1400;

function isWorthKeeping(dimensions) {
    if (!dimensions || !dimensions.width || !dimensions.height) return false;
    const { width, height } = dimensions;
    if (width < MIN_IMAGE_EDGE && height < MIN_IMAGE_EDGE) return false;
    return width * height >= MIN_IMAGE_PIXELS;
}

/**
 * Downscales and re-encodes, so what is stored is a predictable size regardless
 * of what the document happened to hold. JPEG keeps these small, which matters
 * because they are served with every answer that cites the page.
 */
async function toStoredImage(image) {
    const buffer = await image
        .resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: 82 })
        .toBuffer();

    return { buffer, contentType: 'image/jpeg' };
}

/**
 * Encodes decoded pixels, as pdf.js provides them.
 * @returns {Promise<{buffer: Buffer, width: number, height: number, contentType: string}|null>}
 */
async function encodeRawPixels({ data, width, height }) {
    if (!data || !width || !height) return null;

    const raw = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (!raw.length) return null;

    // Grayscale, RGB, and RGBA all turn up depending on the source image.
    const channels = Math.round(raw.length / (width * height));
    if (![1, 3, 4].includes(channels)) return null;

    const stored = await toStoredImage(sharp(raw, { raw: { width, height, channels } }));
    return { ...stored, width, height };
}

/**
 * Re-encodes an already encoded image, as a Word file stores it.
 * @returns {Promise<{buffer: Buffer, width: number, height: number, contentType: string}|null>}
 */
async function encodeImageFile(buffer) {
    if (!buffer || !buffer.length) return null;

    const image = sharp(buffer, { failOn: 'none' });
    const meta = await image.metadata();
    if (!isWorthKeeping(meta)) return null;

    const stored = await toStoredImage(image);
    return { ...stored, width: meta.width, height: meta.height };
}

/** Identifies a picture by its content, so one repeated on every page is kept once. */
function fingerprint(buffer) {
    return crypto.createHash('sha1').update(buffer).digest('hex');
}

module.exports = {
    MIN_IMAGE_EDGE,
    MIN_IMAGE_PIXELS,
    MAX_IMAGES_PER_DOCUMENT,
    MAX_IMAGE_EDGE,
    isWorthKeeping,
    encodeRawPixels,
    encodeImageFile,
    fingerprint
};
