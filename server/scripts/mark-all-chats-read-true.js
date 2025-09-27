// Usage: node mark-all-chats-read-true.js
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');

const chatCollection = 'chat'; // Collection name

async function main() {
    console.log('Connecting to database...');
    const connectionString = process.env.MONGODB_URI || config.connectionString;
    if (!connectionString) {
        throw new Error('MongoDB connection string not found');
    }
    await mongoose.connect(connectionString, { useNewUrlParser: true, useUnifiedTopology: true });
    const now = new Date();
    const logLines = [];
    console.log('Connected to database.');
    console.log('Looking for chat messages with read: false...');
    const Chat = mongoose.connection.collection(chatCollection);
    const query = { read: false };
    const chats = await Chat.find(query).toArray();
    console.log(`Found ${chats.length} chat(s) with read: false.`);
    logLines.push(`Found ${chats.length} chat(s) with read: false.`);
    if (chats.length === 0) {
        console.log('No unread chats found.');
        logLines.push('No unread chats found.');
    } else {
        for (const chat of chats) {
            const msg = `Marking chat _id: ${chat._id} as read: true`;
            console.log(msg);
            logLines.push(msg);
        }
        const result = await Chat.updateMany(query, { $set: { read: true } });
        const updateMsg = `Updated ${result.modifiedCount} chat(s) to read: true.`;
        console.log(updateMsg);
        logLines.push(updateMsg);
    }
    // Write log to file
    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
    const logFile = path.join(logDir, `mark-all-chats-read-true-${now.toISOString().replace(/[:.]/g, '-')}.log`);
    fs.writeFileSync(logFile, logLines.join('\n'), 'utf8');
    console.log(`\nLog written to: ${logFile}`);
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
}); 