/**
 * Proves a brand new visitor can reach the AI tools.
 *
 * Those routes sit behind authorize(), so access depends on the whole chain
 * working: register, sign in, then call an AI endpoint with the returned token.
 * A break anywhere in it looks the same from the browser — a login that refuses
 * a correct password — so this walks the chain and reports where it stops.
 *
 *   node scripts/signup-access-check.js
 *   node scripts/signup-access-check.js --url https://my-profiling-app-v17.onrender.com
 */
const nodeFetch = require('node-fetch');

const args = process.argv.slice(2);
function arg(name, fallback) {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? fallback : args[i + 1];
}

const BASE = (arg('url', 'http://localhost:5001') || '').replace(/\/$/, '');
const email = `signup-check-${Date.now()}@example.com`;
const password = 'CheckPassw0rd!';

async function post(path, body, token) {
    const res = await nodeFetch(`${BASE}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
    });
    let payload = null;
    try { payload = await res.json(); } catch (e) { /* empty or non-JSON body */ }
    return { status: res.status, payload };
}

(async () => {
    console.log(`target            ${BASE}`);
    console.log(`test account      ${email}\n`);

    const reg = await post('/accounts/register', {
        firstName: 'Signup', lastName: 'Check',
        email, password, confirmPassword: password, acceptTerms: true
    });

    if (reg.status !== 200) {
        console.log(`register          FAILED (${reg.status}) ${reg.payload?.message || ''}`);
        process.exitCode = 1;
        return;
    }
    console.log(`register          OK — "${reg.payload?.message || ''}"`);

    const login = await post('/accounts/authenticate', { email, password });
    if (login.status !== 200 || !login.payload?.jwtToken) {
        console.log(`sign in           FAILED (${login.status}) ${login.payload?.message || ''}`);
        console.log('\nThe account exists but cannot sign in. authenticate() rejects an');
        console.log('unverified account with this same wording, so check whether');
        console.log('registration activated it or is waiting on an email link.');
        process.exitCode = 1;
        return;
    }
    console.log('sign in           OK — token issued');

    // The AI tools call this first; a 401 here means the tools are unreachable
    // even though the account works.
    const res = await nodeFetch(`${BASE}/api/ai/status`, {
        headers: { Authorization: `Bearer ${login.payload.jwtToken}` }
    });
    let status = null;
    try { status = await res.json(); } catch (e) { /* non-JSON error body */ }

    if (res.status !== 200) {
        console.log(`ai reachable      FAILED (${res.status}) ${status?.message || ''}`);
        process.exitCode = 1;
        return;
    }

    console.log('ai reachable      OK');
    console.log(`  configured      ${status.configured}${status.configured ? '' : '  <-- no OPENAI_API_KEY'}`);
    console.log(`  chat model      ${status.chatModel || '(none)'}`);
    console.log(`  voice           ${status.ttsProvider || '(none)'}`);
    console.log(`  image limit     ${status.imageDailyLimit ?? '(none)'} per day`);

    if (!status.configured) {
        console.log('\nA visitor can sign in and open the tools, but every AI call will fail.');
        process.exitCode = 1;
        return;
    }
    console.log('\na new visitor can sign up and use the AI tools');
})();
