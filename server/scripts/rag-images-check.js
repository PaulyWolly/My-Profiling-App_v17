/**
 * Checks that a PDF's pictures survive indexing and land on the right page.
 *
 * RAG answers can show the pictures from the pages they were built on, which
 * only works if extraction keeps each picture's page and the text is split the
 * same way. This exercises the real extraction service, either on a generated
 * fixture or on a file you point it at.
 *
 *   node scripts/rag-images-check.js
 *   node scripts/rag-images-check.js --file "BANANA BREAD.pdf" --out ./extracted
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const { extractPdfContent } = require('../services/pdf-content.service');

const args = process.argv.slice(2);
function arg(name, fallback) {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? fallback : args[i + 1];
}

const sourceFile = arg('file', null);
const outDir = arg('out', null);

/** A recognizable picture, so a wrong result is obvious rather than plausible. */
async function samplePhoto(hue) {
    return sharp({ create: { width: 600, height: 400, channels: 3, background: hue } })
        .composite([{
            input: Buffer.from('<svg width="600" height="400"><circle cx="300" cy="200" r="120" fill="yellow"/></svg>'),
            top: 0,
            left: 0
        }])
        .jpeg({ quality: 90 })
        .toBuffer();
}

/** Text on both pages, a picture on page 2 only, and a tiny logo that should be ignored. */
async function buildFixture() {
    const { PDFDocument, StandardFonts } = require('pdf-lib');
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);

    const p1 = pdf.addPage([612, 792]);
    p1.drawText('BANANA BREAD', { x: 60, y: 700, size: 24, font });
    p1.drawText('Ingredients: 3 ripe bananas, 1/3 cup melted butter, 1 tsp baking soda.', { x: 60, y: 660, size: 12, font });

    const logo = await pdf.embedJpg(await sharp({
        create: { width: 40, height: 40, channels: 3, background: { r: 200, g: 0, b: 0 } }
    }).jpeg().toBuffer());
    p1.drawImage(logo, { x: 500, y: 720, width: 40, height: 40 });

    const photo = await pdf.embedJpg(await samplePhoto({ r: 20, g: 90, b: 200 }));
    const p2 = pdf.addPage([612, 792]);
    p2.drawText('Recipe Images', { x: 60, y: 700, size: 18, font });
    p2.drawImage(photo, { x: 60, y: 400, width: 300, height: 200 });

    return Buffer.from(await pdf.save());
}

(async () => {
    let buffer;
    if (sourceFile) {
        buffer = fs.readFileSync(sourceFile);
        console.log(`source        ${path.basename(sourceFile)} (${(buffer.length / 1024).toFixed(0)} KB)\n`);
    } else {
        buffer = await buildFixture();
        console.log('source        generated fixture');
        console.log('              page 1: text + 40x40 logo, page 2: "Recipe Images" + one photo\n');
    }

    const started = Date.now();
    const { pages, images, truncatedImages } = await extractPdfContent(buffer);
    const elapsed = Date.now() - started;

    console.log(`pages         ${pages.length}`);
    for (const page of pages) {
        const preview = page.text.slice(0, 60).replace(/\s+/g, ' ');
        console.log(`  page ${String(page.page).padEnd(3)} ${String(page.text.length).padStart(6)} chars  ${preview}${page.text.length > 60 ? '…' : ''}`);
    }

    console.log(`\nimages        ${images.length}${truncatedImages ? ' (hit the per-document cap)' : ''}`);
    for (const image of images) {
        console.log(`  page ${String(image.page).padEnd(3)} ${image.width}x${image.height}  ${(image.buffer.length / 1024).toFixed(0)} KB ${image.contentType}`);
        if (outDir) {
            fs.mkdirSync(outDir, { recursive: true });
            const file = path.join(outDir, `page${image.page}-${image.width}x${image.height}.jpg`);
            fs.writeFileSync(file, image.buffer);
            console.log(`           wrote ${file}`);
        }
    }

    console.log(`\nextracted in  ${elapsed}ms`);

    if (sourceFile) {
        if (!images.length) {
            console.log('\nNo pictures were recovered. This file may draw them as vector art,');
            console.log('which cannot be extracted — a page render would be needed instead.');
        }
        return;
    }

    // The fixture has a known shape, so the result can be judged rather than eyeballed.
    const problems = [];
    if (pages.length !== 2) problems.push(`expected 2 pages, got ${pages.length}`);
    if (!/BANANA BREAD/i.test(pages[0]?.text || '')) problems.push('page 1 text missing');
    if (!/Recipe Images/i.test(pages[1]?.text || '')) problems.push('page 2 text missing');
    if (images.length !== 1) problems.push(`expected 1 picture (the logo should be skipped), got ${images.length}`);
    if (images[0] && images[0].page !== 2) problems.push(`picture reported on page ${images[0].page}, should be page 2`);

    if (problems.length) {
        console.log('\nFAILED');
        problems.forEach((p) => console.log(`  - ${p}`));
        process.exitCode = 1;
    } else {
        console.log('\nPASS — text kept its pages, the photo was found on page 2, the logo was skipped');
    }
})();
