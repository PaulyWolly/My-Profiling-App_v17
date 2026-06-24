const nodemailer = require('nodemailer');

function getConfig() {
    try {
        return require('../secrets/config.json');
    } catch (e) {
        return {};
    }
}

function isSmtpConfigured(config) {
    const user = config.smtpOptions?.auth?.user;
    const pass = config.smtpOptions?.auth?.pass;
    if (!user || !pass) return false;
    if (String(user).includes('REPLACE') || String(pass).includes('SMTP') || String(pass).includes('REPLACE')) {
        return false;
    }
    return true;
}

async function sendEmail({ to, subject, html, text }) {
    const config = getConfig();
    const from = config.emailFrom || config.smtpOptions?.auth?.user || 'noreply@localhost';

    if (!isSmtpConfigured(config)) {
        console.log('\n[send-email] SMTP not configured — logging message instead of sending:');
        console.log(`  To: ${to}`);
        console.log(`  Subject: ${subject}`);
        console.log(`  Body:\n${text || html}\n`);
        return { logged: true };
    }

    const transporter = nodemailer.createTransport(config.smtpOptions);
    await transporter.sendMail({ from, to, subject, html, text });
    return { sent: true };
}

module.exports = { sendEmail, isSmtpConfigured };
