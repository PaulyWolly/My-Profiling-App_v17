/**
 * Checks how chat questions are reduced to an image search subject.
 *
 * Guards two things: request wording ("provide images of X") must not leak verbs
 * into the query, and subjects that happen to contain a request-ish word
 * ("fence post") must survive intact.
 *
 *   node scripts/image-query-check.js
 */
const { extractImageSearchQuery, wantsImages } = require('../services/image-search.service');

const CASES = [
    ['tell me about the box jellyfish and provide images', 'box jellyfish'],
    ['provide images of a box jellyfish', 'box jellyfish'],
    ['can you provide me with some pictures of a king cobra', 'king cobra'],
    ['please share photos of a black mamba snake', 'black mamba snake'],
    ['post pictures of a ten penny nail', 'ten penny nail'],
    ['show me more images of the blue-ringed octopus', 'blue ringed octopus'],
    ['fetch us a few pics of a great white shark', 'great white shark'],
    ['I want images of a fence post', 'fence post'],
    ['pictures of a lamp post', 'lamp post'],
    ['tell me about the king cobra and show me images', 'king cobra']
];

let failed = 0;

for (const [question, expected] of CASES) {
    const actual = extractImageSearchQuery(question);
    const ok = actual.toLowerCase() === expected.toLowerCase() && wantsImages(question);
    if (!ok) failed += 1;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  "${question}"`);
    console.log(`        -> "${actual}"${ok ? '' : `   (expected "${expected}")`}`);
}

console.log(`\n${CASES.length - failed}/${CASES.length} passed`);
process.exitCode = failed ? 1 : 0;
