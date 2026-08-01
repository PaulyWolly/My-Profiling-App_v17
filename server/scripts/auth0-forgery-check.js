/**
 * Confirms the Auth0 login route refuses a token it did not issue.
 *
 * POST /accounts/auth0/authenticate turns the email inside a bearer token into
 * an application session, and grants Super-Admin when that email matches a known
 * address. If the token's signature is not checked, anyone can write that email
 * into a token of their own and be handed the session. This forges exactly such
 * a token and expects a 401.
 *
 *   node scripts/auth0-forgery-check.js
 *   node scripts/auth0-forgery-check.js --url https://my-profiling-app-v17.onrender.com
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodeFetch = require('node-fetch');

const args = process.argv.slice(2);
function arg(name, fallback) {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? fallback : args[i + 1];
}

const BASE = (arg('url', 'http://localhost:5001') || '').replace(/\/$/, '');
const DOMAIN = process.env.AUTH0_DOMAIN || 'pwconsulting.auth0.com';
const AUDIENCE = process.env.AUTH0_AUDIENCE || 'https://my-profiling-app-api';
/** The address the route treats as Super-Admin. */
const TARGET = 'pwelby@pwconsulting.com';

async function attempt(label, token) {
    const res = await nodeFetch(`${BASE}/accounts/auth0/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({})
    });
    let body = null;
    try { body = await res.json(); } catch (e) { /* non-JSON body */ }

    const granted = res.status === 200 && !!body?.jwtToken;
    console.log(`  ${label.padEnd(26)} ${res.status}${granted ? '  SESSION GRANTED' : ''}`);
    return { granted, status: res.status, body };
}

(async () => {
    console.log(`target            ${BASE}`);
    console.log(`forging as        ${TARGET}\n`);

    let failures = 0;

    // Signed with a key that is ours, not Auth0's. The payload is shaped exactly
    // like a genuine token, so only the signature distinguishes it.
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const claims = {
        sub: 'google-oauth2|000000000000000000000',
        email: TARGET,
        email_verified: true,
        name: 'Not The Owner',
        iss: `https://${DOMAIN}/`,
        aud: AUDIENCE,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
    };

    const rs256 = jwt.sign(claims, privateKey, { algorithm: 'RS256', keyid: 'forged-key-id' });
    const forged = await attempt('self-signed RS256', rs256);
    if (forged.granted) failures += 1;

    // "alg": "none" asks the server to skip signature checking altogether.
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.` +
                     `${Buffer.from(JSON.stringify(claims)).toString('base64url')}.`;
    const none = await attempt('unsigned (alg=none)', unsigned);
    if (none.granted) failures += 1;

    // A token signed with a symmetric key, in case HS256 is accepted and the
    // public key could be used as the shared secret.
    const hs256 = jwt.sign(claims, 'not-the-real-secret', { algorithm: 'HS256' });
    const symmetric = await attempt('HS256 shared secret', hs256);
    if (symmetric.granted) failures += 1;

    const garbage = await attempt('malformed token', 'not.a.jwt');
    if (garbage.granted) failures += 1;

    console.log('');
    if (failures) {
        console.log(`FORGERY ACCEPTED — ${failures} of 4 forged tokens were given a session.`);
        console.log('Anyone able to reach this endpoint can obtain Super-Admin.');
        process.exitCode = 1;
    } else {
        console.log('all forged tokens rejected');
        console.log('\nThis only proves forgeries fail. Confirm a real Google sign-in still');
        console.log('works in the browser before shipping.');
    }
})();
