/**
 * Sends a picture through a chat turn the way the composer's + button does, and
 * checks the answer is about that picture rather than a generic reply.
 *
 *   node scripts/chat-vision-check.js ["path/to/picture.jpg"]
 *
 * With no argument it draws a fixture the answer has to describe: a red circle
 * on a white square.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'secrets', '.env') });

const fs = require('fs');
const sharp = require('sharp');
const openaiService = require('../services/openai.service');

async function fixture() {
    const circle = Buffer.from(
        '<svg width="400" height="400"><rect width="400" height="400" fill="white"/>' +
        '<circle cx="200" cy="200" r="120" fill="red"/></svg>'
    );
    return sharp(circle).png().toBuffer();
}

(async () => {
    const path = process.argv[2];
    const buffer = path ? fs.readFileSync(path) : await fixture();
    const mime = path && /\.png$/i.test(path) ? 'image/png' : (path ? 'image/jpeg' : 'image/png');

    const cases = [
        { label: 'with a question', messages: [{ role: 'user', content: 'What shape and colour is this?' }] },
        { label: 'picture only', messages: [{ role: 'user', content: '' }] }
    ];

    let failures = 0;

    for (const test of cases) {
        try {
            const reply = await openaiService.chatAboutImage(test.messages, buffer, mime, {});
            const flat = reply.toLowerCase();
            // Only meaningful for the fixture; a supplied picture just gets shown.
            const onTopic = path ? !!reply.trim() : (flat.includes('red') && flat.includes('circle'));

            if (!onTopic) failures += 1;
            console.log(`\n${onTopic ? 'ok  ' : 'FAIL'}  ${test.label}`);
            console.log(`      ${reply.replace(/\s+/g, ' ').slice(0, 220)}`);
        } catch (err) {
            failures += 1;
            console.log(`\nFAIL  ${test.label}: ${err && err.message ? err.message : err}`);
        }
    }

    console.log(failures ? `\n${failures} failure(s)` : '\nthe model answered about the picture');
    process.exitCode = failures ? 1 : 0;
})();
