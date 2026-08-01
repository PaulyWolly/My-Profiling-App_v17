/**
 * Times to first token for one identical request, repeated.
 *
 * Chat latency has been erratic — the same "hello" has measured both 1s and
 * 12s. Averages hide that, so this prints every run and flags the outliers,
 * which is what tells us whether the first request in a process is special or
 * whether slow turns land at random.
 *
 *   node scripts/chat-ttft-check.js [runs] ["your message"]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'secrets', '.env') });

const OpenAI = require('openai');

const RUNS = Math.max(1, parseInt(process.argv[2] || '10', 10));
const MESSAGE = process.argv[3] || 'hello';
const MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-5-nano';
const EFFORT = process.env.OPENAI_REASONING_EFFORT || 'low';

/** Anything past this is what a user notices and complains about. */
const SLOW_MS = 4000;

function readKey() {
    if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
    try {
        return require('../secrets/config.json').openAiApiKey;
    } catch {
        return null;
    }
}

async function time(client) {
    const started = Date.now();
    let first = null;
    let chars = 0;

    const stream = await client.chat.completions.create({
        model: MODEL,
        reasoning_effort: EFFORT,
        messages: [{ role: 'user', content: MESSAGE }],
        stream: true
    });

    for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
            if (first === null) first = Date.now() - started;
            chars += delta.length;
        }
    }

    return { first, total: Date.now() - started, chars };
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

(async () => {
    const apiKey = readKey();
    if (!apiKey) {
        console.log('No OpenAI key found; nothing to measure.');
        process.exitCode = 1;
        return;
    }

    const client = new OpenAI({ apiKey, timeout: 120_000, maxRetries: 0 });
    console.log(`model="${MODEL}"  effort="${EFFORT}"  message="${MESSAGE}"  runs=${RUNS}\n`);
    console.log('  run   first text        total   chars');

    const firsts = [];
    for (let run = 1; run <= RUNS; run++) {
        try {
            const r = await time(client);
            if (r.first !== null) firsts.push(r.first);
            const flag = r.first !== null && r.first > SLOW_MS ? '  <-- SLOW' : '';
            console.log(
                `  ${String(run).padStart(3)}` +
                `${String(r.first === null ? '-' : `${r.first} ms`).padStart(13)}` +
                `${String(`${r.total} ms`).padStart(13)}` +
                `${String(r.chars).padStart(8)}${flag}`
            );
        } catch (err) {
            console.log(`  ${String(run).padStart(3)}  FAILED: ${err && err.message ? err.message : err}`);
        }
    }

    if (!firsts.length) return;

    const slow = firsts.filter((v) => v > SLOW_MS);
    console.log(`\n  first token: min ${Math.min(...firsts)} ms, median ${median(firsts)} ms, max ${Math.max(...firsts)} ms`);
    console.log(`  over ${SLOW_MS} ms: ${slow.length} of ${firsts.length} runs`);
    console.log(`  first run was ${firsts[0] > SLOW_MS ? 'SLOW' : 'fast'} (${firsts[0]} ms)`);
})();
