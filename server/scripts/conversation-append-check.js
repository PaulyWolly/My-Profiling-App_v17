/**
 * Verifies appendConversation against a real database: it creates the document
 * on first use, appends in order, caps history at MAX_MESSAGES, and survives
 * concurrent saves without losing a turn. The concurrency case is the reason
 * the write is a single atomic $push — turns are now saved after the reply has
 * been sent, so two can overlap.
 *
 * Uses a throwaway account id and deletes it afterwards.
 *
 *   node scripts/conversation-append-check.js
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', 'secrets', '.env') });

const mongoose = require('mongoose');

const db = require('../_helpers/db');
const aiMemoryService = require('../services/ai-memory.service');

const accountId = new mongoose.Types.ObjectId();
let failed = 0;

function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) {
        failed += 1;
        console.log(`  FAIL  ${label} (got ${actual}, expected ${expected})`);
    } else {
        console.log(`  ok    ${label}`);
    }
}

/** Scripts run outside server.js, which is where the connection is normally opened. */
async function connect() {
    let fileUri = '';
    try {
        fileUri = require('../secrets/config.json').connectionString || '';
    } catch {
        fileUri = '';
    }

    // .env can hold a placeholder, so take whichever value is a real URI,
    // preferring the config file the way local dev does.
    const isUri = (value) => /^mongodb(\+srv)?:\/\//i.test(String(value || '').trim());
    const uri = [fileUri, process.env.MONGODB_URI].find(isUri);
    if (!uri) {
        console.log('No valid MongoDB connection string found.');
        return false;
    }

    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
        return mongoose.connection.readyState === 1;
    } catch (err) {
        console.log(`connection failed: ${err.message || err}`);
        return false;
    }
}

(async () => {
    if (!(await connect())) {
        console.log('Database did not connect; cannot verify.');
        process.exitCode = 1;
        return;
    }

    try {
        console.log(`throwaway account ${accountId}\n`);

        const first = await aiMemoryService.appendConversation(accountId, 'first question', 'first answer');
        check('returns a conversation id', !!first.id, true);
        let convo = await aiMemoryService.getConversation(accountId, first.id);
        check('creates the document on first save', convo.messages.length, 2);
        check('stores the user text', convo.messages[0].content, 'first question');
        check('stores the reply', convo.messages[1].content, 'first answer');
        check('titles from the first question', convo.title, 'first question');

        await aiMemoryService.appendConversation(accountId, 'second question', 'second answer', first.id);
        convo = await aiMemoryService.getConversation(accountId, first.id);
        check('appends rather than replaces', convo.messages.length, 4);
        check('keeps order', convo.messages[3].content, 'second answer');

        const second = await aiMemoryService.appendConversation(accountId, 'other thread', 'other reply');
        check('starts a second conversation without an id', first.id !== second.id, true);
        const listed = await aiMemoryService.listConversations(accountId);
        check('lists both conversations', listed.length, 2);

        // Two turns racing: the old read-modify-write could drop one.
        await Promise.all([
            aiMemoryService.appendConversation(accountId, 'race A', 'reply A', first.id),
            aiMemoryService.appendConversation(accountId, 'race B', 'reply B', first.id)
        ]);
        convo = await aiMemoryService.getConversation(accountId, first.id);
        check('keeps both concurrent turns', convo.messages.length, 8);

        const max = aiMemoryService.MAX_MESSAGES;
        const turns = Math.ceil(max / 2) + 3;
        for (let i = 0; i < turns; i += 1) {
            await aiMemoryService.appendConversation(accountId, `q${i}`, `a${i}`, first.id);
        }
        convo = await aiMemoryService.getConversation(accountId, first.id);
        check(`caps history at ${max}`, convo.messages.length, max);
        check('keeps the newest turn', convo.messages[convo.messages.length - 1].content, `a${turns - 1}`);
    } catch (err) {
        failed += 1;
        console.log(`  FAILED: ${err && err.message ? err.message : err}`);
    } finally {
        await db.AiConversation.deleteMany({ accountId }).catch(() => { });
        const left = await db.AiConversation.countDocuments({ accountId }).catch(() => -1);
        console.log(`\ncleanup: ${left === 0 ? 'throwaway documents removed' : `WARNING leftover count ${left}`}`);
        await mongoose.connection.close().catch(() => { });
    }

    console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed');
    process.exitCode = failed ? 1 : 0;
})();
