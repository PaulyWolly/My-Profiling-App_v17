/**
 * Presses "more images" a few times for a subject and reports whether each
 * press brings back pictures that were not already on screen.
 *
 *   node scripts/image-more-check.js ["show me pictures of bugs bunny"]
 */
const { fetchImagesForChat, fetchMoreImages } = require('../services/image-search.service');

const QUESTIONS = process.argv[2]
    ? [process.argv[2]]
    : [
        'show me pictures of bugs bunny',
        'show me pictures of a king cobra'
    ];

const PRESSES = 3;
const key = (url) => String(url || '').split('?')[0].toLowerCase();

(async () => {
    let failures = 0;

    for (const question of QUESTIONS) {
        const first = await fetchImagesForChat(question);
        const seen = new Set(first.images.map((img) => key(img.url)));

        console.log(`\n"${question}"`);
        console.log(`  initial      ${String(first.images.length).padStart(2)} image(s)`);

        for (let press = 1; press <= PRESSES; press += 1) {
            const more = await fetchMoreImages(first.query, { exclude: [...seen] });
            const repeats = more.images.filter((img) => seen.has(key(img.url))).length;
            const fresh = more.images.length - repeats;

            if (repeats > 0) failures += 1;
            if (!more.images.length) failures += 1;

            console.log(
                `  press ${press}      ${String(more.images.length).padStart(2)} image(s)` +
                `  ${String(fresh).padStart(2)} new  ${repeats} repeat(s)` +
                `${repeats || !more.images.length ? '   <-- problem' : ''}`
            );
            for (const img of more.images.slice(0, 3)) {
                console.log(`                 - ${String(img.title || '(untitled)').slice(0, 50)}`);
            }

            for (const img of more.images) seen.add(key(img.url));
        }

        console.log(`  total shown  ${seen.size} distinct image(s)`);
    }

    console.log(failures ? `\n${failures} problem(s)` : '\nevery press returned new images');
    process.exitCode = failures ? 1 : 0;
})();
