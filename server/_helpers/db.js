const mongoose = require('mongoose');
const config = require('../config.json');

// Use environment variable for MongoDB connection string if available
const connectionString = process.env.MONGODB_URI || config.connectionString;

if (connectionString === 'MONGODB_URI') {
    throw new Error('MongoDB connection string not found in environment variables');
}

// Models
const Account = require('../accounts/account.model');
const Chat = require('../models/chat.model');
const RefreshToken = require('../accounts/refresh-token.model');

// Helper function to validate MongoDB ObjectId
function isValidId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

module.exports = {
    Account,
    Chat,
    RefreshToken,
    isValidId,
    CleanupHistory: require('../admin/cleanup-history.model')
};
