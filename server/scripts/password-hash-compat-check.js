/**
 * Proves the two password libraries agree on the stored hash format.
 *
 * Accounts hold a hash, not a password, so a change to the hashing library that
 * altered the format would lock every existing user out — and it would surface
 * at the login screen in production, not at build time. This app hashes with
 * both `bcrypt` (native) and `bcryptjs` (pure JavaScript) in different places,
 * so either must be able to read what the other wrote.
 *
 * Run after upgrading either library:
 *
 *   node scripts/password-hash-compat-check.js
 *
 * Everything happens in one process against a throwaway password, and only the
 * outcome is reported — no hash is stored or printed.
 */
const bcrypt = require('bcrypt');
const bcryptjs = require('bcryptjs');

const PASSWORD = 'throwaway-value-for-this-check';
const WRONG = 'not-the-same-value';

function versionOf(name) {
    try {
        return require(`${name}/package.json`).version;
    } catch (e) {
        return 'unknown';
    }
}

console.log(`bcrypt   ${versionOf('bcrypt')}  (native)`);
console.log(`bcryptjs ${versionOf('bcryptjs')}  (pure JavaScript)\n`);

// Each library writes a hash, and both are then asked to read both.
const native = bcrypt.hashSync(PASSWORD, 10);
const pure = bcryptjs.hashSync(PASSWORD, 10);

const checks = [
    ['native library reads its own hash ', () => bcrypt.compareSync(PASSWORD, native)],
    ['native library reads a pure hash  ', () => bcrypt.compareSync(PASSWORD, pure)],
    ['pure library reads a native hash  ', () => bcryptjs.compareSync(PASSWORD, native)],
    ['pure library reads its own hash   ', () => bcryptjs.compareSync(PASSWORD, pure)],
    ['both refuse a wrong password      ', () => !bcrypt.compareSync(WRONG, native) &&
                                                 !bcryptjs.compareSync(WRONG, pure)],
    ['the stored format is unchanged    ', () => /^\$2[aby]\$\d{2}\$/.test(native) &&
                                                 /^\$2[aby]\$\d{2}\$/.test(pure)]
];

let failed = 0;
for (const [label, run] of checks) {
    let ok;
    try {
        ok = run();
    } catch (err) {
        ok = false;
    }
    console.log(`  ${ok ? 'pass' : 'FAIL'}  ${label}`);
    if (!ok) failed += 1;
}

console.log(failed
    ? `\n${failed} check(s) failed — existing accounts may not be able to sign in.`
    : '\nPASS — the hash format is unchanged and both libraries agree, so stored passwords still verify.');
process.exitCode = failed ? 1 : 0;
