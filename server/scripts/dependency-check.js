/**
 * Finds packages the code imports but package.json does not declare.
 *
 * An undeclared package still works locally whenever some other dependency
 * happens to pull it in, so nothing looks wrong until that dependency is
 * removed or changes its own requirements — and then the failure appears on the
 * host as MODULE_NOT_FOUND, at startup, after a deploy that built cleanly.
 * Every import is checked against what is declared and what actually resolves.
 *
 *   node scripts/dependency-check.js
 */
const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));

const declared = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {})
]);
const builtin = new Set(builtinModules);

const SKIP_DIRS = new Set(['node_modules', '.git', 'secrets', 'uploads']);

function jsFiles(dir, found = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) jsFiles(full, found);
        else if (entry.name.endsWith('.js')) found.push(full);
    }
    return found;
}

/** The installable name, so `sharp` and `pdfjs-dist/legacy/build/pdf.mjs` both resolve to a package. */
function packageName(request) {
    const parts = request.split('/');
    return request.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

const files = jsFiles(root);
const undeclared = new Map();
const unresolvable = new Map();

for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const requests = [
        ...source.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g),
        ...source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)
    ].map((m) => m[1]);

    for (const request of requests) {
        if (request.startsWith('.') || request.startsWith('/') || request.startsWith('node:')) continue;

        const name = packageName(request);
        if (builtin.has(name)) continue;

        const relative = path.relative(root, file).replace(/\\/g, '/');

        if (!declared.has(name)) {
            if (!undeclared.has(name)) undeclared.set(name, new Set());
            undeclared.get(name).add(relative);
        }

        // Declared but absent would break just as badly, and catches a bad lockfile.
        try {
            require.resolve(request, { paths: [root] });
        } catch (err) {
            if (!unresolvable.has(request)) unresolvable.set(request, new Set());
            unresolvable.get(request).add(relative);
        }
    }
}

console.log(`scanned ${files.length} files, ${declared.size} declared packages\n`);

const report = (title, map, hint) => {
    if (!map.size) return 0;
    console.log(`${title}`);
    for (const [name, users] of map) {
        console.log(`  ${name}`);
        for (const file of users) console.log(`      ${file}`);
    }
    console.log(`  ${hint}\n`);
    return map.size;
};

const a = report(
    'IMPORTED BUT NOT DECLARED:',
    undeclared,
    'These work only while another dependency happens to install them.'
);
const b = report(
    'CANNOT BE RESOLVED:',
    unresolvable,
    'These will throw MODULE_NOT_FOUND when the file is loaded.'
);

if (!a && !b) {
    console.log('PASS — every import is declared and resolves.');
} else {
    console.log(`FAILED — ${a + b} problem(s) found.`);
    process.exitCode = 1;
}
