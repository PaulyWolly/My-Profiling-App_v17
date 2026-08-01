/**
 * Shows what is stored for an account's followerImages versus what the API
 * would return for them.
 *
 * "Details are not saving" has two very different causes — the write never
 * landed, or it landed and the response drops it on the way out. This prints
 * both sides so they can be told apart.
 *
 *   node scripts/follower-images-check.js [email]
 */
const mongoose = require('mongoose');

const EMAIL = (process.argv[2] || 'tbird@looney.com').toLowerCase();

async function connect() {
    let fileUri = '';
    try {
        fileUri = require('../secrets/config.json').connectionString || '';
    } catch {
        fileUri = '';
    }
    const isReal = (v) => /^mongodb(\+srv)?:\/\//.test(v || '');
    const uri = isReal(fileUri) ? fileUri : (isReal(process.env.MONGODB_URI) ? process.env.MONGODB_URI : '');
    if (!uri) throw new Error('No valid MongoDB connection string found.');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

(async () => {
    await connect();
    const db = require('../_helpers/db');

    const raw = await db.Account.findOne({ email: EMAIL }).lean();
    if (!raw) {
        console.log(`No account found for ${EMAIL}`);
        return mongoose.disconnect();
    }

    console.log(`account: ${EMAIL}  (${raw._id})\n`);

    console.log('--- what is actually STORED in MongoDB ---');
    console.log(JSON.stringify(raw.followerImages, null, 2));

    // getById() runs the account through basicDetails(), which is what every
    // profile response uses, so this is the real path rather than a copy of it.
    const accountService = require('../accounts/account.service');
    const returned = await accountService.getById(raw._id.toString());

    console.log('\n--- what the API actually returns ---');
    console.log(JSON.stringify(returned.followerImages, null, 2));

    const storedCount = (raw.followerImages || []).length;
    const firstStored = (raw.followerImages || [])[0] || {};
    const firstOut = (returned.followerImages || [])[0] || {};
    const expected = Object.keys(firstStored).filter((k) => k !== '_id');
    const missing = expected.filter((k) => firstOut[k] === undefined);
    const internals = Object.keys(firstOut).filter((k) => k.startsWith('$') || k.startsWith('__') || k === '_doc');

    console.log('\n--- verdict ---');
    console.log(`stored followers      ${storedCount}`);
    console.log(`stored fields on #1   ${expected.join(', ') || '(none)'}`);
    console.log(`missing from response ${missing.join(', ') || '(none)'}`);
    console.log(`mongoose internals    ${internals.join(', ') || '(none)'}`);

    const ok = storedCount > 0 && !missing.length && !internals.length;
    console.log(`\n${ok ? 'OK — every stored field reaches the client' : 'FAIL — the response is dropping fields'}`);

    await mongoose.disconnect();
    process.exitCode = ok ? 0 : 1;
})().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exitCode = 1;
});
