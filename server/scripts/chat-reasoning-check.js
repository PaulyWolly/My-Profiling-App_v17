/**
 * gpt-5 models think before they answer, and that thinking happens before any
 * text is produced. This times a simple question at each reasoning effort so the
 * setting can be chosen from measurements rather than guesswork.
 *
 *   node scripts/chat-reasoning-check.js ["your message"]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'secrets', '.env') });

const OpenAI = require('openai');

const MESSAGE = process.argv[2] || 'what is a limerick';
const MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-5-nano';
const EFFORTS = ['minimal', 'low', 'medium'];

function readKey() {
    if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
    try {
        return require('../secrets/config.json').openAiApiKey;
    } catch {
        return null;
    }
}

(async () => {
    const apiKey = readKey();
    if (!apiKey) {
        console.log('No OpenAI key found; nothing to measure.');
        process.exitCode = 1;
        return;
    }

    const client = new OpenAI({ apiKey });
    console.log(`model   = ${MODEL}`);
    console.log(`message = "${MESSAGE}"\n`);
    console.log('  effort     first text     total   chars');

    for (const effort of EFFORTS) {
        const started = Date.now();
        let firstDelta = null;
        let text = '';

        try {
            const stream = await client.chat.completions.create({
                model: MODEL,
                reasoning_effort: effort,
                messages: [{ role: 'user', content: MESSAGE }],
                stream: true
            });

            for await (const chunk of stream) {
                const delta = chunk.choices?.[0]?.delta?.content;
                if (delta) {
                    if (firstDelta === null) firstDelta = Date.now() - started;
                    text += delta;
                }
            }

            const total = Date.now() - started;
            console.log(
                `  ${effort.padEnd(9)}` +
                `${String(firstDelta === null ? '-' : `${firstDelta} ms`).padStart(11)}` +
                `${String(`${total} ms`).padStart(10)}` +
                `${String(text.length).padStart(8)}`
            );
        } catch (err) {
            console.log(`  ${effort.padEnd(9)}  FAILED: ${err && err.message ? err.message : err}`);
        }
    }
})();
