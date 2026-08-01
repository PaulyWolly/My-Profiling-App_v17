const mammoth = require('mammoth');

const {
    MAX_IMAGES_PER_DOCUMENT,
    encodeImageFile,
    fingerprint
} = require('./document-images');

/**
 * Reads the text and the pictures out of a Word (.docx) file.
 *
 * A Word file has no pages. Pagination is produced by whatever renders the
 * document — it depends on the paper size, the fonts installed, even the
 * printer — so there is nothing stored in the file to number. The rest of the
 * pipeline works in pages, and uses them to show an answer the pictures that
 * sat near the text it came from, which is worth keeping. So the document is
 * cut into sections of roughly a page of prose, and a picture takes the number
 * of the section it appears in. Sections are numbered, not paginated: callers
 * are told as much through `paginated`, so nothing claims a page number that
 * the document does not actually have.
 */

/** Roughly a page of prose. Sections only need to be small enough to localize a picture. */
const SECTION_CHARS = 3000;

/**
 * Marks where a picture sat, so its position survives the strip to plain text.
 * Plain ASCII, because it has to pass through an HTML attribute untouched.
 */
const MARKER = (index) => `@@RAGIMG${index}@@`;
const MARKER_PATTERN = /@@RAGIMG(\d+)@@/g;

/** Elements that separate words; without this "one</p><p>two" becomes "onetwo". */
const BLOCK_TAGS = /<\/(p|div|h[1-6]|li|tr|br)\s*>|<br\s*\/?>/gi;

/**
 * A picture's marker is carried in the src attribute, so it has to be lifted out
 * into the text before tags are stripped — otherwise it is discarded with the
 * tag that holds it, and every picture appears to sit at the start of the file.
 */
const IMG_TAG = /<img\b[^>]*>/gi;

function liftImageMarkers(html) {
    return html.replace(IMG_TAG, (tag) => {
        const marker = tag.match(/@@RAGIMG\d+@@/);
        return marker ? `\n${marker[0]}\n` : '';
    });
}

function htmlToText(html) {
    return liftImageMarkers(html)
        .replace(BLOCK_TAGS, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** Splits on a paragraph boundary where possible, so a section does not start mid-sentence. */
function toSections(text) {
    if (!text) return [];

    const sections = [];
    let rest = text;
    let number = 1;

    while (rest.length > SECTION_CHARS) {
        const window = rest.slice(0, SECTION_CHARS);
        const breakAt = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('\n'));
        const cut = breakAt > SECTION_CHARS * 0.5 ? breakAt : SECTION_CHARS;

        sections.push({ page: number, text: rest.slice(0, cut).trim() });
        rest = rest.slice(cut);
        number += 1;
    }

    if (rest.trim()) sections.push({ page: number, text: rest.trim() });
    return sections;
}

/**
 * @returns {Promise<{ pages: Array<{page: number, text: string}>, images: Array<{page: number, buffer: Buffer, width: number, height: number, contentType: string}>, paginated: boolean }>}
 */
async function extractDocxContent(buffer) {
    const collected = [];

    // Converted to HTML rather than straight to text, because only the HTML
    // conversion reports images, and it reports them in place.
    const result = await mammoth.convertToHtml(
        { buffer },
        {
            convertImage: mammoth.images.imgElement(async (image) => {
                const index = collected.length;
                collected.push(image);
                return { src: MARKER(index) };
            })
        }
    );

    for (const message of result.messages || []) {
        if (message.type === 'error') {
            console.warn('[DOCX] extraction warning:', message.message);
        }
    }

    // The markers survive into the plain text, so where each picture sat is known.
    const withMarkers = htmlToText(result.value || '');

    const positions = new Map();
    let clean = '';
    let last = 0;
    for (const match of withMarkers.matchAll(MARKER_PATTERN)) {
        clean += withMarkers.slice(last, match.index);
        positions.set(parseInt(match[1], 10), clean.length);
        last = match.index + match[0].length;
    }
    clean += withMarkers.slice(last);

    const pages = toSections(clean);

    const sectionAt = (offset) => {
        let running = 0;
        for (const section of pages) {
            running += section.text.length;
            if (offset <= running) return section.page;
        }
        return pages.length || 1;
    };

    const images = [];
    const seen = new Set();

    for (let index = 0; index < collected.length; index += 1) {
        if (images.length >= MAX_IMAGES_PER_DOCUMENT) break;

        let encoded;
        try {
            const source = await collected[index].read();
            encoded = await encodeImageFile(Buffer.isBuffer(source) ? source : Buffer.from(source));
        } catch (err) {
            console.warn(`[DOCX] could not read image ${index} —`, err.message);
            continue;
        }
        if (!encoded) continue;

        const id = fingerprint(encoded.buffer);
        if (seen.has(id)) continue;
        seen.add(id);

        // A picture with no recorded position belongs to the first section; that
        // only happens when the conversion drops it out of the flow.
        const offset = positions.has(index) ? positions.get(index) : 0;
        images.push({ page: sectionAt(offset), ...encoded });
    }

    return { pages, images, paginated: false };
}

module.exports = {
    extractDocxContent,
    SECTION_CHARS
};
