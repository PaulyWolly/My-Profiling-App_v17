/**
 * The gallery below a reply is the only picture source. Model chatter about
 * images — "I can't display them", numbered Wikimedia links — must not remain.
 *
 *   node scripts/image-mention-strip-check.js
 */
const { stripModelImageMentions } = require('../services/image-search.service');

const SAMPLE = `
Blue-ringed octopuses are small but venomous.

Images

I can't display images directly here, but here are image options you can view. If you'd like, I can fetch higher-resolution galleries or official datasets.

1) Hapalochlaena lunulata (blue-ringed octopus) — example image https://upload.wikimedia.org/wikipedia/commons/d/d6/Variable_ring_patterns_on_mantles_of_the_blue-ringed_octopus_Hapalochlaena_lunulata.png Source: Wikimedia Commons
2) Another shot https://live.staticflickr.com/123/octopus.jpg Source: Flickr

If you'd like, I can pull more precise, citable images from official sources or compile a small gallery with captions.
`.trim();

const cleaned = stripModelImageMentions(SAMPLE);
const keep = /Blue-ringed octopuses are small but venomous/.test(cleaned);
const drop = [
    /can't display images/i,
    /image options/i,
    /upload\.wikimedia\.org/i,
    /staticflickr/i,
    /If you'd like/i,
    /gallery with captions/i,
    /^\s*Images\s*$/m
];

const leftover = drop.filter((re) => re.test(cleaned));
const ok = keep && leftover.length === 0;

console.log(ok ? 'ok    stripped image chatter, kept the article' : 'FAIL  strip result:');
if (!ok) {
    console.log(cleaned);
    if (!keep) console.log('  missing article text');
    leftover.forEach((re) => console.log(`  still matches ${re}`));
}

process.exitCode = ok ? 0 : 1;
