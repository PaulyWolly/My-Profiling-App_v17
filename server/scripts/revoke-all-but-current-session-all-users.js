// Usage: node revoke-all-but-current-session-all-users.js
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const config = require('../secrets/config.json');
const db = require('../_helpers/db'); // Just require, do not call connect()
const RefreshToken = require('../accounts/refresh-token.model');
const Account = require('../accounts/account.model');

async function main() {
    console.log('Connecting to database...');
    const connectionString = process.env.MONGODB_URI || config.connectionString;
    if (!connectionString) {
        throw new Error('MongoDB connection string not found');
    }
    await mongoose.connect(connectionString, { useNewUrlParser: true, useUnifiedTopology: true });
    const now = new Date();
    const logLines = [];
    let totalRevoked = 0;
    let totalUsers = 0;
    console.log('Connected to database.');
    console.log('Looking for users with active sessions...');
    // Find all unique user IDs with active sessions
    const userIds = await RefreshToken.distinct('account', { revoked: null, expires: { $gt: now } });
    console.log(`Found ${userIds.length} users with active sessions.`);
    for (const userId of userIds) {
        const account = await Account.findById(userId);
        const userLabel = account ? `${account.firstName || ''} ${account.lastName || ''} <${account.email}>` : `UserID: ${userId}`;
        console.log(`\nFound user ${userId} (${userLabel})`);
        // Find all active sessions for this user
        const sessions = await RefreshToken.find({ account: userId, revoked: null, expires: { $gt: now } }).sort({ created: -1 });
        console.log(`User has ${sessions.length} active session(s).`);
        if (sessions.length <= 1) {
            const skipMsg = `[SKIP] ${userLabel} - Only 1 or 0 active sessions.`;
            logLines.push(skipMsg);
            console.log(skipMsg);
            continue;
        }
        totalUsers++;
        const [mostRecent, ...toRevoke] = sessions;
        const revokedTokens = [];
        const userMsg = `[USER] ${userLabel}`;
        logLines.push(userMsg);
        console.log(userMsg);
        const keptMsg = `  Keeping session: ${mostRecent.token} (created: ${mostRecent.created})`;
        logLines.push(keptMsg);
        console.log(keptMsg);
        for (const session of toRevoke) {
            const foundMsg = `  Found session: ${session.token} (created: ${session.created})`;
            console.log(foundMsg);
            logLines.push(foundMsg);
            session.revoked = now;
            session.revokedReason = 'Revoked by script (all but most recent, all users)';
            await session.save();
            const revokeMsg = `  Revoked session: ${session.token} (created: ${session.created})`;
            revokedTokens.push({ token: session.token, created: session.created });
            logLines.push(revokeMsg);
            console.log(revokeMsg);
            totalRevoked++;
        }
        console.log('Processing next user...');
    }
    const summaryMsg = `\nSummary: Processed ${userIds.length} users, revoked ${totalRevoked} sessions.`;
    logLines.push(summaryMsg);
    console.log(summaryMsg);
    // Write log to file
    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
    const logFile = path.join(logDir, `revoke-sessions-${now.toISOString().replace(/[:.]/g, '-')}.log`);
    fs.writeFileSync(logFile, logLines.join('\n'), 'utf8');
    console.log(`\nLog written to: ${logFile}`);
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
}); 