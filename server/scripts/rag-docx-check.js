/**
 * Checks that a Word document's text and pictures survive indexing.
 *
 * A .docx has no pages — pagination is produced by whatever renders it — so the
 * document is cut into numbered sections instead, and a picture takes the number
 * of the section it sits in. That association is what lets an answer show the
 * pictures near the text it came from, so it is worth proving rather than
 * assuming.
 *
 *   node scripts/rag-docx-check.js
 *   node scripts/rag-docx-check.js --file recipe.docx --out ./extracted
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const { extractDocxContent, SECTION_CHARS } = require('../services/docx-content.service');

const args = process.argv.slice(2);
function arg(name, fallback) {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? fallback : args[i + 1];
}

const sourceFile = arg('file', null);
const outDir = arg('out', null);

/** A recognizable picture, so a wrong result is obvious rather than plausible. */
function photo(background) {
    return sharp({ create: { width: 600, height: 400, channels: 3, background } })
        .composite([{
            input: Buffer.from('<svg width="600" height="400"><circle cx="300" cy="200" r="120" fill="yellow"/></svg>'),
            top: 0,
            left: 0
        }])
        .jpeg({ quality: 90 })
        .toBuffer();
}

/**
 * Long enough to span sections, with a picture near the start and another well
 * past the first section boundary, so a picture landing in the wrong section is
 * visible in the result.
 */
async function buildFixture() {
    let docx;
    try {
        docx = require('docx');
    } catch (err) {
        console.log('The `docx` package builds the sample file and is a dev dependency.');
        console.log('Run `npm install` here, or pass --file to check a real document.');
        process.exitCode = 1;
        return null;
    }

    const { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel } = docx;
    const filler = 'Cream the butter and the sugar until pale, then fold the flour through in three additions. ';
    const paragraphsPerSection = Math.ceil(SECTION_CHARS / filler.length) + 2;

    const body = [
        new Paragraph({ text: 'BANANA BREAD', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun('Ingredients: 3 ripe bananas, 1/3 cup melted butter.')] }),
        new Paragraph({
            children: [new ImageRun({ data: await photo({ r: 20, g: 90, b: 200 }), transformation: { width: 300, height: 200 } })]
        })
    ];

    for (let i = 0; i < paragraphsPerSection; i += 1) {
        body.push(new Paragraph({ children: [new TextRun(filler)] }));
    }

    body.push(new Paragraph({ text: 'Recipe Images', heading: HeadingLevel.HEADING_2 }));
    body.push(new Paragraph({
        children: [new ImageRun({ data: await photo({ r: 200, g: 60, b: 30 }), transformation: { width: 300, height: 200 } })]
    }));

    const doc = new Document({ sections: [{ children: body }] });
    return Packer.toBuffer(doc);
}

(async () => {
    let buffer;
    if (sourceFile) {
        buffer = fs.readFileSync(sourceFile);
        console.log(`source        ${path.basename(sourceFile)} (${(buffer.length / 1024).toFixed(0)} KB)\n`);
    } else {
        buffer = await buildFixture();
        if (!buffer) return;
        console.log('source        generated fixture');
        console.log(`              two photos, separated by more than ${SECTION_CHARS} characters\n`);
    }

    const started = Date.now();
    const { pages, images, paginated } = await extractDocxContent(buffer);
    const elapsed = Date.now() - started;

    console.log(`paginated     ${paginated} (sections, not pages)`);
    console.log(`sections      ${pages.length}`);
    for (const section of pages) {
        const preview = section.text.slice(0, 58).replace(/\s+/g, ' ');
        console.log(`  part ${String(section.page).padEnd(3)} ${String(section.text.length).padStart(6)} chars  ${preview}…`);
    }

    console.log(`\nimages        ${images.length}`);
    for (const image of images) {
        console.log(`  part ${String(image.page).padEnd(3)} ${image.width}x${image.height}  ${(image.buffer.length / 1024).toFixed(0)} KB ${image.contentType}`);
        if (outDir) {
            fs.mkdirSync(outDir, { recursive: true });
            const file = path.join(outDir, `part${image.page}-${image.width}x${image.height}.jpg`);
            fs.writeFileSync(file, image.buffer);
            console.log(`           wrote ${file}`);
        }
    }

    console.log(`\nextracted in  ${elapsed}ms`);

    if (sourceFile) {
        if (!images.length) console.log('\nNo pictures were found in this document.');
        return;
    }

    const problems = [];
    if (!/BANANA BREAD/i.test(pages[0]?.text || '')) problems.push('the heading is missing from the first section');
    if (!pages.some((p) => /Recipe Images/i.test(p.text))) problems.push('the later heading is missing');
    if (pages.length < 2) problems.push(`expected the text to span more than one section, got ${pages.length}`);
    if (images.length !== 2) problems.push(`expected 2 pictures, got ${images.length}`);
    if (images[0] && images[0].page !== 1) problems.push(`first picture landed in part ${images[0].page}, should be part 1`);
    if (images[1] && images[1].page === 1) problems.push('second picture landed in part 1, so position was not tracked');

    if (problems.length) {
        console.log('\nFAILED');
        problems.forEach((p) => console.log(`  - ${p}`));
        process.exitCode = 1;
    } else {
        console.log('\nPASS — text kept its order and each picture landed in the section it sits in');
    }
})();
