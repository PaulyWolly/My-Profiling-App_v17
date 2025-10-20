const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    senderId: { type: String, required: true },
    recipientId: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
});

module.exports = mongoose.model('Chat', chatSchema, 'chat');
