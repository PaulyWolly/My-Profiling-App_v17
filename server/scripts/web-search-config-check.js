/**
 * Verifies that config/web-search-triggers.json behaves safely: edits apply
 * without a restart, notes are not treated as triggers, and a broken file keeps
 * chat working on the previous list.
 *
 * The file is restored afterwards. No API calls are made.
 *
 *   node scripts/web-search-config-check.js
 */
const fs = require('fs');
const path = require('path');

const { needsWebSearch } = require('../services/openai.service');

const FILE = path.join(__dirname, '..', 'config', 'web-search-triggers.json');
const original = fs.readFileSync(FILE, 'utf8');

let failed = 0;

function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`);
}

function write(json) {
    fs.writeFileSync(FILE, JSON.stringify(json, null, 2));
    // mtime resolution can be coarse; force a change the loader will notice.
    const future = new Date(Date.now() + 1000);
    fs.utimesSync(FILE, future, future);
}

try {
    console.log('baseline');
    check('"who won the game" searches', needsWebSearch('who won the game'), true);
    check('"what is a limerick" does not', needsWebSearch('what is a limerick'), false);
    check('note text is not a trigger', needsWebSearch('Answers that change over time'), false);

    console.log('\nedit applies without restart');
    write({ groups: { custom: ['flux capacitor'] } });
    check('new trigger works', needsWebSearch('tell me about the flux capacitor'), true);
    check('removed trigger stops matching', needsWebSearch('who won the game'), false);

    console.log('\nunderscore keys are notes, not triggers');
    write({ groups: { _note: ['definitely not a trigger'], custom: ['flux capacitor'] } });
    check('note ignored', needsWebSearch('definitely not a trigger'), false);
    check('real trigger still works', needsWebSearch('flux capacitor'), true);

    console.log('\nbroken file keeps the previous list');
    fs.writeFileSync(FILE, '{ this is not valid json');
    fs.utimesSync(FILE, new Date(Date.now() + 2000), new Date(Date.now() + 2000));
    check('previous trigger survives', needsWebSearch('flux capacitor'), true);
    check('chat still answers', typeof needsWebSearch('Hello') === 'boolean', true);
} finally {
    fs.writeFileSync(FILE, original);
    console.log('\noriginal file restored');
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed');
process.exitCode = failed ? 1 : 0;
