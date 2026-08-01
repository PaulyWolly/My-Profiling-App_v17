/**
 * Confirms an oversized upload survives the trip to the vision API.
 *
 * Images are sent inline as base64, which the API refuses past 20MB, so uploads
 * larger than that are resized first. This builds an image too big to send as
 * is, pushes it through the real describeImage path, and checks a description
 * comes back — the resize is only correct if the API actually accepts it.
 *
 *   node scripts/image-resize-check.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'secrets', '.env') });

const sharp = require('sharp');
const openaiService = require('../services/openai.service');

/** Noise barely compresses, so this reliably produces a very large PNG. */
async function hugeImage(width, height) {
    const channels = 3;
    const pixels = Buffer.allocUnsafe(width * height * channels);
    for (let i = 0; i < pixels.length; i += 1) {
        pixels[i] = Math.floor(Math.random() * 256);
    }
    return sharp(pixels, { raw: { width, height, channels } }).png().toBuffer();
}

/** Something recognizable, to prove the resized image is still readable. */
async function readableImage(width, height) {
    return sharp({
        create: { width, height, channels: 3, background: { r: 20, g: 90, b: 200 } }
    })
        .composite([{
            input: Buffer.from(
                `<svg width="${width}" height="${height}">` +
                `<circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 3}" fill="yellow"/>` +
                `</svg>`
            ),
            top: 0,
            left: 0
        }])
        .png()
        .toBuffer();
}

(async () => {
    console.log('building an oversized image...');
    const noise = await hugeImage(4200, 3200);
    const mb = (b) => `${(b.length / (1024 * 1024)).toFixed(1)} MB`;
    console.log(`  raw upload            ${mb(noise)}`);
    console.log(`  as base64             ${(noise.length * 1.334 / (1024 * 1024)).toFixed(1)} MB  (API refuses over 20 MB)`);

    let ok = true;

    try {
        const description = await openaiService.describeImage(noise, 'image/png');
        console.log(`  describe (oversized)  OK — ${description.slice(0, 60).replace(/\s+/g, ' ')}...`);
    } catch (err) {
        console.log(`  describe (oversized)  FAILED: ${err && err.message ? err.message : err}`);
        ok = false;
    }

    // A big but meaningful picture, to be sure resizing preserves the subject.
    const circle = await readableImage(5000, 5000);
    console.log(`\n  second image          ${mb(circle)} (yellow circle on blue)`);
    try {
        const description = await openaiService.describeImage(circle, 'image/png');
        const text = description.toLowerCase();
        const recognized = /circle|yellow|blue|sun|dot|round/.test(text);
        console.log(`  describe (subject)    ${recognized ? 'OK' : 'UNSURE'} — ${description.slice(0, 70).replace(/\s+/g, ' ')}...`);
        ok = ok && recognized;
    } catch (err) {
        console.log(`  describe (subject)    FAILED: ${err && err.message ? err.message : err}`);
        ok = false;
    }

    console.log(ok ? '\noversized uploads are resized and understood' : '\nsomething is wrong');
    process.exitCode = ok ? 0 : 1;
})();
