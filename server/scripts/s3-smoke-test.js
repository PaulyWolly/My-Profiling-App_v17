/**
 * Exercises the S3 service end to end against the real bucket.
 *
 * Profile image uploads go through here, and the failure modes that matter are
 * runtime ones the linter cannot see: a missing Location on the upload result,
 * or fileExists throwing instead of returning false when an object is absent.
 * Uploads a throwaway object, checks it, deletes it, and confirms it is gone.
 *
 *   node scripts/s3-smoke-test.js
 */
const s3Service = require('../services/s3.service');

const KEY_NAME = `smoke-test-${Date.now()}.txt`;
const FOLDER = 'smoke-test';
const BODY = Buffer.from(`s3 smoke test ${new Date().toISOString()}`);

function report(label, ok, detail) {
    console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${label.padEnd(34)}${detail || ''}`);
    return ok;
}

(async () => {
    console.log(`bucket = ${s3Service.bucketName}  region = ${s3Service.region}\n`);

    let ok = true;
    let url = null;
    const key = `${FOLDER}/${KEY_NAME}`;

    try {
        url = await s3Service.uploadFile(BODY, KEY_NAME, 'text/plain', FOLDER);
        ok = report('upload returns a URL', typeof url === 'string' && url.startsWith('http'), url) && ok;
    } catch (err) {
        return void report('upload', false, err.message);
    }

    try {
        // The uploaded URL must map back to the key we asked for, because
        // deleteFile reverses exactly this step.
        const roundTripped = s3Service.extractKeyFromUrl(url);
        ok = report('URL maps back to the key', roundTripped === key, `${roundTripped} vs ${key}`) && ok;
    } catch (err) {
        ok = report('URL maps back to the key', false, err.message);
    }

    try {
        ok = report('fileExists finds it', (await s3Service.fileExists(key)) === true) && ok;
    } catch (err) {
        ok = report('fileExists finds it', false, err.message);
    }

    try {
        const missing = await s3Service.fileExists(`${FOLDER}/definitely-not-here-${Date.now()}.txt`);
        ok = report('fileExists returns false on 404', missing === false, `returned ${missing}`) && ok;
    } catch (err) {
        ok = report('fileExists returns false on 404', false, `threw instead: ${err.message}`);
    }

    try {
        ok = report('delete succeeds', (await s3Service.deleteFile(url)) === true) && ok;
    } catch (err) {
        ok = report('delete succeeds', false, err.message);
    }

    try {
        ok = report('object is gone after delete', (await s3Service.fileExists(key)) === false) && ok;
    } catch (err) {
        ok = report('object is gone after delete', false, err.message);
    }

    console.log(ok ? '\nS3 service works end to end' : '\nsomething is broken');
    process.exitCode = ok ? 0 : 1;
})();
