/**
 * Runs a real image lookup end to end against the live sources for a handful of
 * subjects, reporting how many images survive the relevance filter and which
 * source each one came from.
 *
 *   node scripts/image-search-live.js ["custom subject"]
 */
const { fetchImagesForChat } = require('../services/image-search.service');

const QUESTIONS = process.argv[2]
    ? [process.argv[2]]
    : [
        'tell me about the box jellyfish and provide images',
        'show me pictures of a king cobra',
        'provide images of a blue-ringed octopus',
        'show me pictures of bugs bunny',
        'show me images of a ten penny nail'
    ];

(async () => {
    let empty = 0;

    for (const question of QUESTIONS) {
        try {
            const result = await fetchImagesForChat(question);
            const count = (result.images || []).length;
            if (!count) empty += 1;

            console.log(`\n"${question}"`);
            console.log(`  query  = "${result.query}"`);
            console.log(`  images = ${count}`);
            for (const img of (result.images || []).slice(0, 6)) {
                const title = String(img.title || '(untitled)').slice(0, 52);
                console.log(`    - ${title.padEnd(52)}  [${img.source || 'unknown'}]`);
            }
        } catch (err) {
            empty += 1;
            console.log(`\n"${question}"\n  FAILED: ${err && err.message ? err.message : err}`);
        }
    }

    console.log(`\n${QUESTIONS.length - empty}/${QUESTIONS.length} returned images`);
    process.exitCode = empty ? 1 : 0;
})();
