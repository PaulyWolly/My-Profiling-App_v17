const mongoose = require('mongoose');

const sessionInfoSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    email: { type: String, required: true },
    sessionId: { type: String, required: true },
    loginTime: { type: Date, required: true },
    logoutTime: { type: Date },
    durationSec: { type: Number },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SessionInfo', sessionInfoSchema, 'session-info'); 