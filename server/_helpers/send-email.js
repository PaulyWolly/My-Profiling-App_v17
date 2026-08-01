const nodemailer = require('nodemailer');

function fileConfig() {
    try {
        return require('../secrets/config.json');
    } catch (e) {
        return {};
    }
}

/** A value copied straight out of a template, which would fail to authenticate. */
function isPlaceholder(value) {
    return /^<|>$|REPLACE|SMTP PASSWORD/i.test(String(value || ''));
}

/**
 * SMTP settings, preferring the environment over the secrets file.
 *
 * Hosts inject credentials as environment variables, and the config.json written
 * on Render carries no mail settings at all, so the file is only a fallback for
 * local development.
 */
function getSmtpConfig() {
    const config = fileConfig();
    const options = config.smtpOptions || {};
    const auth = options.auth || {};

    const host = process.env.SMTP_HOST || options.host || '';
    const port = parseInt(process.env.SMTP_PORT || options.port || '587', 10);
    const user = process.env.SMTP_USER || auth.user || '';
    // SMTP_APP_PASSWORD is accepted because the env template shipped that name.
    const pass = process.env.SMTP_PASS || process.env.SMTP_APP_PASSWORD || auth.pass || '';

    return {
        from: process.env.EMAIL_FROM || config.emailFrom || user || 'noreply@localhost',
        options: {
            host,
            port,
            // 465 is implicit TLS; 587 upgrades with STARTTLS after connecting.
            secure: port === 465,
            auth: { user, pass }
        }
    };
}

function isSmtpConfigured() {
    const { options } = getSmtpConfig();
    const { host, auth } = options;
    if (!host || !auth.user || !auth.pass) return false;
    return !isPlaceholder(host) && !isPlaceholder(auth.user) && !isPlaceholder(auth.pass);
}

/**
 * Sends a message, or logs it when no mail server is configured.
 *
 * Logging keeps local development usable without credentials: the verification
 * and reset links are printed to the console and can be pasted into a browser.
 * It is not acceptable in production, where a user who never receives the link
 * has no way to finish signing up, so the caller is told which happened.
 */
async function sendEmail({ to, subject, html, text }) {
    const { from, options } = getSmtpConfig();

    if (!isSmtpConfigured()) {
        console.log('\n[send-email] SMTP not configured — logging message instead of sending:');
        console.log(`  To: ${to}`);
        console.log(`  Subject: ${subject}`);
        console.log(`  Body:\n${text || html}\n`);
        return { logged: true, sent: false };
    }

    const transporter = nodemailer.createTransport(options);
    await transporter.sendMail({ from, to, subject, html, text });
    return { logged: false, sent: true };
}

module.exports = { sendEmail, isSmtpConfigured, getSmtpConfig };
