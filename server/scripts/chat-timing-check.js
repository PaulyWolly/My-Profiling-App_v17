/**
 * Times the pieces of a chat turn, so slow replies can be attributed to a stage
 * rather than guessed at.
 *
 * The reply itself and the memory-fact extraction are timed separately because
 * the route waits for both before answering the browser.
 *
 *   node scripts/chat-timing-check.js ["your message"]
 *   OPENAI_CHAT_WEB_SEARCH=false node scripts/chat-timing-check.js   (compare)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'secrets', '.env') });

const openaiService = require('../services/openai.service');

const MESSAGE = process.argv[2] || 'Hello';

async function time(label, fn) {
    const started = Date.now();
    try {
        const value = await fn();
        const ms = Date.now() - started;
        console.log(`  ${label.padEnd(22)} ${String(ms).padStart(6)} ms`);
        return { ms, value };
    } catch (err) {
        const ms = Date.now() - started;
        console.log(`  ${label.padEnd(22)} ${String(ms).padStart(6)} ms  FAILED: ${err && err.message ? err.message : err}`);
        return { ms, value: null };
    }
}

(async () => {
    const config = openaiService.getChatConfig();
    console.log(`message   = "${MESSAGE}"`);
    console.log(`model     = ${config.model}`);
    console.log(`webSearch = ${config.webSearch}`);
    console.log(`reasoning = ${config.reasoningEffort}\n`);

    const messages = [{ role: 'user', content: MESSAGE }];

    const reply = await time('chat reply', () => openaiService.chat(messages, {}));
    const facts = await time('memory extraction', () =>
        openaiService.extractUserMemoryFacts(MESSAGE, reply.value || '')
    );

    console.log(`\n  ${'total blocking'.padEnd(22)} ${String(reply.ms + facts.ms).padStart(6)} ms`);
    if (reply.value) {
        console.log(`\nreply: ${String(reply.value).slice(0, 120)}...`);
    }
})();
