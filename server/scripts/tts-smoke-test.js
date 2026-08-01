/**
 * Smoke test for the active text-to-speech provider.
 *
 * Synthesizes a short phrase and reports the audio size, so the speech path can be
 * verified without a browser or a logged-in session. Azure is used when its
 * credentials are present, otherwise OpenAI.
 *
 *   node scripts/tts-smoke-test.js
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', 'secrets', '.env') });

const azure = require('../services/azure-tts.service');
const openai = require('../services/openai.service');

/**
 * Timed at three lengths because synthesis cost scales with the text, which
 * decides whether speaking a long reply is worth splitting into sentences.
 */
const PHRASES = [
    ['short', '12 eggs is a dozen.'],
    ['medium', 'Hello. Conversation mode is working. This is a slightly longer line of speech.'],
    ['long', 'A limerick is a short, humorous five-line poem with a distinctive rhythm and rhyme. '
        + 'The first, second, and fifth lines rhyme with each other and have three stresses. '
        + 'The third and fourth lines are shorter, rhyme with each other, and have two stresses. '
        + 'Limericks are usually playful and often end with a twist or a punchline.']
];

const RUNS = Number(process.argv[2]) || 2;

(async () => {
    const useAzure = azure.isConfigured();
    const provider = useAzure ? azure : openai;
    const voice = provider.getTtsConfig().defaultVoice;

    console.log(`provider = ${useAzure ? 'azure' : 'openai'}`);
    console.log(`voice    = ${voice}`);
    console.log(`runs     = ${RUNS} per phrase\n`);
    console.log('  phrase    chars   times                     bytes');

    let failed = false;

    for (const [label, phrase] of PHRASES) {
        const times = [];
        let bytes = 0;

        for (let i = 0; i < RUNS; i += 1) {
            const started = Date.now();
            try {
                const result = await provider.synthesizeSpeech(phrase, voice);
                times.push(Date.now() - started);
                bytes = result.buffer.length;
            } catch (err) {
                console.log(`  ${label.padEnd(9)} FAILED: ${err && err.message ? err.message : err}`);
                failed = true;
                break;
            }
        }

        if (times.length) {
            const timing = times.map((t) => `${t}ms`).join(', ');
            console.log(
                `  ${label.padEnd(9)}${String(phrase.length).padStart(5)}   ` +
                `${timing.padEnd(22)}${String(bytes).padStart(8)}`
            );
        }
    }

    if (failed) {
        process.exitCode = 1;
    }
})();
