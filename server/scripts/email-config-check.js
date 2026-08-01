/**
 * Reports whether outgoing mail actually works.
 *
 * Without a mail server the app does not fail loudly: it logs the message and
 * carries on, so registration still answers "check your email" while nothing is
 * sent and the new account can never sign in. This makes that state visible, and
 * optionally proves delivery end to end.
 *
 *   node scripts/email-config-check.js
 *   node scripts/email-config-check.js --send you@example.com
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'secrets', '.env') });

const nodemailer = require('nodemailer');
const { sendEmail, isSmtpConfigured, getSmtpConfig } = require('../_helpers/send-email');

const args = process.argv.slice(2);
const sendIndex = args.indexOf('--send');
const recipient = sendIndex === -1 ? null : args[sendIndex + 1];

/** Shows enough of a value to recognize it, without printing a secret. */
function redact(value) {
    const s = String(value || '');
    if (!s) return '(not set)';
    if (s.length <= 4) return '****';
    return `${s.slice(0, 2)}${'*'.repeat(Math.min(8, s.length - 3))}${s.slice(-1)}`;
}

function source(envName, present) {
    if (process.env[envName]) return `env ${envName}`;
    return present ? 'secrets/config.json' : '(not set)';
}

(async () => {
    const { from, options } = getSmtpConfig();
    const configured = isSmtpConfigured();

    console.log('host              ', options.host || '(not set)', ' <-', source('SMTP_HOST', !!options.host));
    console.log('port              ', options.port, options.secure ? '(implicit TLS)' : '(STARTTLS)');
    console.log('user              ', redact(options.auth.user), ' <-', source('SMTP_USER', !!options.auth.user));
    console.log('pass              ', redact(options.auth.pass), ' <-',
        process.env.SMTP_PASS ? 'env SMTP_PASS'
            : process.env.SMTP_APP_PASSWORD ? 'env SMTP_APP_PASSWORD'
            : options.auth.pass ? 'secrets/config.json' : '(not set)');
    console.log('from              ', from);
    console.log('');

    if (!configured) {
        console.log('NOT CONFIGURED — messages are logged to the console, not delivered.');
        console.log('Registration will still report success, but the new account cannot sign in');
        console.log('because authenticate() rejects an unverified account.');
        console.log('\nSet SMTP_HOST, SMTP_USER, SMTP_PASS (and optionally EMAIL_FROM, SMTP_PORT).');
        process.exitCode = 1;
        return;
    }

    console.log('configured — verifying the server accepts these credentials...');
    try {
        await nodemailer.createTransport(options).verify();
        console.log('  handshake        OK');
    } catch (err) {
        console.log(`  handshake        FAILED: ${err && err.message ? err.message : err}`);
        console.log('\nGmail rejects normal passwords here; an App Password is required.');
        process.exitCode = 1;
        return;
    }

    if (!recipient) {
        console.log('\nCredentials work. Re-run with --send <address> to post a real test message.');
        return;
    }

    try {
        const result = await sendEmail({
            to: recipient,
            subject: 'Test message from My-Profiling-App',
            text: 'If you are reading this, verification and password-reset mail will arrive.'
        });
        console.log(`  delivery         ${result.sent ? `OK — sent to ${recipient}` : 'logged only'}`);
    } catch (err) {
        console.log(`  delivery         FAILED: ${err && err.message ? err.message : err}`);
        process.exitCode = 1;
    }
})();
