/**
 * Compares web search latency at each OPENAI_SEARCH_CONTEXT_SIZE setting.
 *
 * Search time swings a lot from run to run, so a single sample proves nothing.
 * This runs several attempts per setting and reports the median alongside the
 * range, and prints each reply so a faster setting can be checked for accuracy
 * rather than just speed.
 *
 *   node scripts/chat-search-latency-check.js ["question"] [runs]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'secrets', '.env') });

const QUESTION = process.argv[2] || 'Who is POTUS';
const RUNS = Number(process.argv[3]) || 3;
const SIZES = ['low', 'medium'];

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function timeOnce(service) {
    const started = Date.now();
    try {
        const reply = await service.chat([{ role: 'user', content: QUESTION }], {});
        return { ms: Date.now() - started, reply: String(reply || '').replace(/\s+/g, ' ') };
    } catch (err) {
        return { ms: Date.now() - started, reply: `FAILED: ${err && err.message ? err.message : err}` };
    }
}

(async () => {
    console.log(`question = "${QUESTION}"   runs per setting = ${RUNS}\n`);
    const results = {};

    for (const size of SIZES) {
        process.env.OPENAI_SEARCH_CONTEXT_SIZE = size;
        // The setting is read when the module loads, so reload it per size.
        delete require.cache[require.resolve('../services/openai.service')];
        const service = require('../services/openai.service');

        const times = [];
        console.log(`search_context_size = ${size}`);
        for (let i = 0; i < RUNS; i += 1) {
            const { ms, reply } = await timeOnce(service);
            times.push(ms);
            console.log(`  run ${i + 1}  ${String(ms).padStart(6)} ms   ${reply.slice(0, 70)}...`);
        }
        results[size] = times;
        console.log(`  median ${String(median(times)).padStart(5)} ms   range ${Math.min(...times)}-${Math.max(...times)} ms\n`);
    }

    console.log('summary');
    for (const size of SIZES) {
        console.log(`  ${size.padEnd(8)} median ${String(median(results[size])).padStart(6)} ms`);
    }
})();
