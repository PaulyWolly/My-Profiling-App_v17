/**
 * Measures what the user actually waits for on each chat path.
 *
 * The two paths behave differently and are judged differently:
 *   - plain questions should stream, so text appears while it is written
 *   - web search questions search first and then tend to emit the answer in one
 *     go, so what matters is that the "searching" status arrives immediately
 *     and the UI can say why it is waiting
 *
 *   node scripts/chat-stream-check.js ["your message"]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'secrets', '.env') });

const openaiService = require('../services/openai.service');

async function run(message) {
    const started = Date.now();
    const searches = openaiService.needsWebSearch(message);
    let firstDelta = null;
    let firstStatus = null;
    let deltas = 0;
    const statuses = [];

    console.log(`\nmessage = "${message}"  (${searches ? 'web search' : 'built-in knowledge'})`);

    const text = await openaiService.chatStream([{ role: 'user', content: message }], {}, (event) => {
        if (event.type === 'delta') {
            deltas += 1;
            if (firstDelta === null) firstDelta = Date.now() - started;
        } else if (event.type === 'status') {
            const at = Date.now() - started;
            if (firstStatus === null) firstStatus = at;
            statuses.push(`${event.value}@${at}ms`);
        }
    });

    const total = Date.now() - started;
    console.log(`  statuses      ${statuses.join(', ') || '(none)'}`);
    console.log(`  first text    ${firstDelta === null ? 'never' : `${firstDelta} ms`}`);
    console.log(`  total         ${total} ms`);
    console.log(`  deltas        ${deltas}`);
    console.log(`  reply         ${String(text).slice(0, 80)}...`);

    if (searches) {
        // The search dominates the wait, so the win is telling the user early.
        const ok = firstStatus !== null && firstStatus < 1000;
        console.log(`  verdict       ${ok ? 'OK' : 'FAIL'} — status shown after ${firstStatus} ms, silent wait avoided`);
        return ok;
    }

    const ok = deltas > 1;
    console.log(`  verdict       ${ok ? 'OK' : 'FAIL'} — text streams in ${deltas} pieces`);
    return ok;
}

(async () => {
    const custom = process.argv[2];
    const messages = custom ? [custom] : ['who is POTUS', 'what is a limerick'];

    let ok = true;
    for (const message of messages) {
        try {
            ok = (await run(message)) && ok;
        } catch (err) {
            console.log(`  FAILED: ${err && err.message ? err.message : err}`);
            ok = false;
        }
    }

    console.log(ok ? '\nboth paths behave as intended' : '\nsomething is off');
    process.exitCode = ok ? 0 : 1;
})();
