const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../secrets/.env') });
const mongoose = require('mongoose');
const config = require('../secrets/config.json');

// MongoDB Schema
const RefreshTokenSchema = new mongoose.Schema({
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    token: String,
    expires: Date,
    created: { type: Date, default: Date.now },
    createdByIp: String,
    revoked: Date,
    revokedByIp: String,
    replacedByToken: String
});

const RefreshToken = mongoose.model('RefreshToken', RefreshTokenSchema);

async function cleanupSessions() {
    try {
        console.log('Starting session cleanup...');

        // Connect to MongoDB
        const connectionString = process.env.MONGODB_URI || config.connectionString;
        if (!connectionString) {
            throw new Error('MongoDB connection string not found');
        }

        await mongoose.connect(connectionString, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB successfully');

        // Get current time and 24 hours ago
        const now = new Date();
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

        console.log('Current time:', now.toISOString());
        console.log('Cleaning up sessions older than:', oneDayAgo.toISOString());

        // First, count total sessions
        const totalSessions = await RefreshToken.countDocuments();
        console.log(`Total sessions before cleanup: ${totalSessions}`);

        // Delete sessions that are:
        // 1. Expired
        // 2. Revoked
        // 3. Older than 24 hours
        // 4. Have been replaced by newer tokens
        const result = await RefreshToken.deleteMany({
            $or: [
                { expires: { $lt: now } },          // Expired tokens
                { revoked: { $ne: null } },         // Revoked tokens
                { created: { $lt: oneDayAgo } },    // Older than 24 hours
                { replacedByToken: { $ne: null } }  // Replaced tokens
            ]
        });

        console.log(`Deleted ${result.deletedCount} old/expired/revoked/replaced sessions`);

        // Now, for each account, keep only the most recent session
        const accounts = await RefreshToken.distinct('account');
        let duplicateSessionsDeleted = 0;

        for (const accountId of accounts) {
            // Get all sessions for this account, sorted by creation date
            const sessions = await RefreshToken.find({ account: accountId })
                .sort({ created: -1 });

            // If there's more than one session, delete all but the most recent
            if (sessions.length > 1) {
                const [mostRecent, ...oldSessions] = sessions;
                const oldSessionIds = oldSessions.map(s => s._id);
                
                const deleteResult = await RefreshToken.deleteMany({
                    _id: { $in: oldSessionIds }
                });
                
                duplicateSessionsDeleted += deleteResult.deletedCount;
            }
        }

        console.log(`Deleted ${duplicateSessionsDeleted} duplicate sessions (keeping only most recent per user)`);

        // Count remaining active sessions
        const activeSessions = await RefreshToken.countDocuments({
            expires: { $gt: now },
            revoked: null
        });

        console.log(`Remaining active sessions: ${activeSessions}`);
        
        // Close connection
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Error during cleanup:', error);
        if (mongoose.connection) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
}

// Run the cleanup
cleanupSessions(); 