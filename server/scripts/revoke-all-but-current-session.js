// Usage: node revoke-all-but-current-session.js <userId>
const mongoose = require('mongoose');
const db = require('../_helpers/db');
const RefreshToken = require('../accounts/refresh-token.model');

async function main() {
    const [,, userId] = process.argv;
    if (!userId) {
        console.error('Usage: node revoke-all-but-current-session.js <userId>');
        process.exit(1);
    }
    await db.connect();
    const now = new Date();
    // Find the most recent active session for the user
    const currentSession = await RefreshToken.findOne({
        account: userId,
        revoked: null,
        expires: { $gt: now }
    }).sort({ created: -1 });
    if (!currentSession) {
        console.log('No active sessions found for user:', userId);
        await mongoose.disconnect();
        return;
    }
    const currentToken = currentSession.token;
    // Revoke all other sessions
    const result = await RefreshToken.updateMany(
        {
            account: userId,
            token: { $ne: currentToken },
            revoked: null,
            expires: { $gt: now }
        },
        {
            $set: {
                revoked: now,
                revokedReason: 'Revoked by script (all but most recent)',
            }
        }
    );
    console.log(`Kept session: ${currentToken}`);
    console.log(`Revoked ${result.modifiedCount} sessions for user ${userId} (all but most recent)`);
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
}); 