/**
 * Times name resolution and the TLS handshake to the APIs the chat turn uses.
 *
 * The first Azure speech request of a process costs about eleven seconds while
 * later ones take under 400ms, which is the delay before audio starts. A stall
 * that size is connection setup, not synthesis. IPv6 is the usual cause: if the
 * host publishes an AAAA record the machine cannot route, the connection waits
 * for a TCP timeout before falling back to IPv4. The OpenAI client already pins
 * family 4 for this reason; the speech client does not.
 *
 *   node scripts/net-connect-check.js [host]
 */
const fs = require('fs');
const path = require('path');
const dns = require('dns');
const tls = require('tls');

// The speech region lives here, the same as it does for the running server.
require('dotenv').config({ path: path.join(__dirname, '..', 'secrets', '.env') });

function azureSpeechHost() {
    let region = process.env.AZURE_SPEECH_REGION || process.env.SPEECH_REGION || '';
    if (!region) {
        try {
            const secrets = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'secrets', 'config.json'), 'utf8'));
            region = secrets.azureSpeechRegion || '';
        } catch {
            region = '';
        }
    }
    return region ? `${region}.tts.speech.microsoft.com` : null;
}

const HOSTS = process.argv[2]
    ? [process.argv[2]]
    : ['api.openai.com', azureSpeechHost()].filter(Boolean);

/**
 * Only the first connection in a process is cold — the OS remembers that a
 * destination was unreachable, so a second probe is fast no matter which family
 * it used. Pass a family to measure exactly one, cold, and compare across runs.
 */
const ONLY_FAMILY = process.argv[3] ? Number(process.argv[3]) : null;

async function time(label, fn) {
    const started = Date.now();
    try {
        const value = await fn();
        console.log(`  ${label.padEnd(26)}${String(`${Date.now() - started} ms`).padStart(9)}   ${value}`);
    } catch (err) {
        console.log(`  ${label.padEnd(26)}${String(`${Date.now() - started} ms`).padStart(9)}   FAILED ${err.code || err.message}`);
    }
}

function connect(host, family) {
    return new Promise((resolve, reject) => {
        const socket = tls.connect({ host, port: 443, servername: host, family }, () => {
            socket.end();
            resolve(socket.remoteAddress);
        });
        socket.on('error', reject);
    });
}

(async () => {
    for (const host of HOSTS) {
        console.log(`\n${host}`);

        if (ONLY_FAMILY !== null) {
            // Nothing else runs first, so this handshake is genuinely cold.
            await time(`TLS connect (family ${ONLY_FAMILY}) COLD`, () => connect(host, ONLY_FAMILY));
            continue;
        }

        await time('dns.resolve4 (A)', () => dns.promises.resolve4(host).then((r) => r.join(', ')));
        await time('dns.resolve6 (AAAA)', () => dns.promises.resolve6(host).then((r) => r.join(', ')));
        // family 0 lets the OS pick, which is what an unpinned client does.
        await time('TLS connect (family auto)', () => connect(host, 0));
        await time('TLS connect (family 4)', () => connect(host, 4));
    }
    console.log('');
})();
