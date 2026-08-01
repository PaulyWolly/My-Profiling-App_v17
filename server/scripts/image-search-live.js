/**
 * Runs a real image lookup end to end against Wikimedia for a handful of
 * subjects, reporting how many images survive the relevance filter.
 *
 *   node scripts/image-search-live.js ["custom subject"]
 */
const { fetchImagesForChat } = require('../services/image-search.service');

const QUESTIONS = process.argv[2]
    ? [process.argv[2]]
    : [
        'tell me about the box jellyfish and provide images',
        'show me pictures of a king cobra',
        'provide images of a blue-ringed octopus'
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
            for (const img of (result.images || []).slice(0, 4)) {
                console.log(`    - ${img.title || '(untitled)'}`);
            }
        } catch (err) {
            empty += 1;
            console.log(`\n"${question}"\n  FAILED: ${err && err.message ? err.message : err}`);
        }
    }

    console.log(`\n${QUESTIONS.length - empty}/${QUESTIONS.length} returned images`);
    process.exitCode = empty ? 1 : 0;
})();
