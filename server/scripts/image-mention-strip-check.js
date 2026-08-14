/**
 * The gallery below a reply is the only picture source. Model chatter about
 * images — "I can't display them", numbered Wikimedia links — must not remain.
 *
 *   node scripts/image-mention-strip-check.js
 */
const {
    stripModelImageMentions,
    stripImageRequestFromQuestion,
    hideImageRequestFromMessages
} = require('../services/image-search.service');

const SAMPLE = `
Blue-ringed octopuses are small but venomous.

Images

I can't display images directly here, but here are image options you can view. If you'd like, I can fetch higher-resolution galleries or official datasets.

1) Hapalochlaena lunulata (blue-ringed octopus) — example image https://upload.wikimedia.org/wikipedia/commons/d/d6/Variable_ring_patterns_on_mantles_of_the_blue-ringed_octopus_Hapalochlaena_lunulata.png Source: Wikimedia Commons
2) Another shot https://live.staticflickr.com/123/octopus.jpg Source: Flickr

If you'd like, I can pull more precise, citable images from official sources or compile a small gallery with captions.
`.trim();

const LEFTOVER_LIST = `
They live in tide pools.

3) Blue-ringed octopus in a tidal pool
4) Close-up showing blue rings (when threatened)
5) General context image

If you'd like, I can assemble a curated gallery with captions from reputable sources... or pull a few verified, citable references about behavior, venom, and safety.
`.trim();

function assertStrip(name, input, mustKeep, mustDrop) {
    const cleaned = stripModelImageMentions(input);
    const missing = mustKeep.filter((re) => !re.test(cleaned));
    const leftover = mustDrop.filter((re) => re.test(cleaned));
    const ok = missing.length === 0 && leftover.length === 0;
    console.log(ok ? `ok    ${name}` : `FAIL  ${name}`);
    if (!ok) {
        console.log(cleaned);
        missing.forEach((re) => console.log(`  missing ${re}`));
        leftover.forEach((re) => console.log(`  still matches ${re}`));
    }
    return ok;
}

let passed = true;
passed = assertStrip(
    'stripped image chatter, kept the article',
    SAMPLE,
    [/Blue-ringed octopuses are small but venomous/],
    [
        /can't display images/i,
        /image options/i,
        /upload\.wikimedia\.org/i,
        /staticflickr/i,
        /If you'd like/i,
        /gallery with captions/i,
        /^\s*Images\s*$/m
    ]
) && passed;

passed = assertStrip(
    'stripped leftover captions and gallery offer',
    LEFTOVER_LIST,
    [/They live in tide pools/],
    [
        /tidal pool/i,
        /Close-up showing/i,
        /context image/i,
        /curated gallery/i,
        /If you'd like/i
    ]
) && passed;

const question = stripImageRequestFromQuestion(
    'Tell me about the blue ringed octopus and provide images'
);
const questionOk = /^tell me about the blue ringed octopus$/i.test(question);
console.log(questionOk ? 'ok    hid the image request from the question' : `FAIL  question became "${question}"`);
passed = passed && questionOk;

const hidden = hideImageRequestFromMessages([
    { role: 'user', content: 'Tell me about the blue ringed octopus and provide images' }
]);
const hiddenOk = !/\bimages?\b/i.test(hidden[0].content);
console.log(hiddenOk ? 'ok    model messages have no image request' : `FAIL  ${hidden[0].content}`);
passed = passed && hiddenOk;

process.exitCode = passed ? 0 : 1;
