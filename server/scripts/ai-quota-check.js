/**
 * Verifies the daily image quota: sequential consumption, refunds, concurrency,
 * and admin exemption. Writes to a throwaway account id and cleans up after.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../secrets/.env') });

const mongoose = require('mongoose');

process.env.AI_IMAGE_DAILY_LIMIT = process.env.AI_IMAGE_DAILY_LIMIT || '5';

const db = require('../_helpers/db');
const usage = require('../services/ai-usage.service');

const LIMIT = usage.IMAGE_DAILY_LIMIT;
const testUser = { id: new mongoose.Types.ObjectId(), role: 'User' };
const adminUser = { id: new mongoose.Types.ObjectId(), role: 'Super-Admin' };

let failures = 0;
function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: got ${actual}, expected ${expected}`);
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
    const isReal = (v) => /^mongodb(\+srv)?:\/\//.test(v || '');
    const uri = isReal(fileUri) ? fileUri : (isReal(process.env.MONGODB_URI) ? process.env.MONGODB_URI : '');
    if (!uri) throw new Error('No valid MongoDB connection string found.');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

async function main() {
    await connect();
    console.log(`Daily image limit: ${LIMIT}\n`);

    console.log('--- sequential consumption ---');
    for (let i = 1; i <= LIMIT; i++) {
        const r = await usage.claimImageGeneration(testUser);
        check(`claim ${i} allowed`, r.allowed, true);
        check(`claim ${i} remaining`, r.remaining, LIMIT - i);
    }

    console.log('\n--- over the limit ---');
    const over = await usage.claimImageGeneration(testUser);
    check('claim past limit refused', over.allowed, false);
    check('remaining is zero', over.remaining, 0);

    console.log('\n--- refund returns one ---');
    await usage.releaseImageGeneration(testUser);
    const afterRefund = await usage.claimImageGeneration(testUser);
    check('claim allowed after refund', afterRefund.allowed, true);

    console.log('\n--- admin is exempt ---');
    for (let i = 0; i < LIMIT + 3; i++) {
        const r = await usage.claimImageGeneration(adminUser);
        if (!r.allowed) { failures++; console.log(`FAIL  admin claim ${i + 1} was refused`); }
    }
    console.log(`PASS  admin made ${LIMIT + 3} claims without refusal`);

    console.log('\n--- concurrent burst cannot exceed the limit ---');
    const burstUser = { id: new mongoose.Types.ObjectId(), role: 'User' };
    const results = await Promise.all(
        Array.from({ length: LIMIT * 4 }, () => usage.claimImageGeneration(burstUser))
    );
    const allowed = results.filter((r) => r.allowed).length;
    check(`allowed out of ${LIMIT * 4} simultaneous`, allowed, LIMIT);

    const standing = await usage.getImageUsage(burstUser);
    check('stored count matches limit', standing.used, LIMIT);

    await db.AiUsage.deleteMany({
        accountId: { $in: [testUser.id, adminUser.id, burstUser.id] }
    });
    await mongoose.disconnect();

    console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
    process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
