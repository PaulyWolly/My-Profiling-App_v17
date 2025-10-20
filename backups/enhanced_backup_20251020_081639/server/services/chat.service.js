const db = require('../_helpers/db');
const { WebSocket } = require('ws');
const express = require('express');
const router = express.Router();
const Chat = require('../models/chat.model');

class WebSocketService {
    constructor() {
        this.connections = new Map(); // userId -> WebSocket
        this.onlineUsers = new Map(); // userId -> user info
    }

    initialize(server) {
        this.wss = new WebSocket.Server({ server });
        
        this.wss.on('connection', async (ws, req) => {
            try {
                // Extract token from query params
                const url = new URL(req.url, 'ws://localhost');
                const token = url.searchParams.get('token');
                
                // Validate token and get user
                const user = await this.validateToken(token);
                if (!user) {
                    ws.close();
                    return;
                }

                // Store connection
                this.connections.set(user.id, ws);
                this.onlineUsers.set(user.id, {
                    id: user.id,
                    name: `${user.firstName} ${user.lastName}`,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    profileImage: user.profileImage,
                    isOnline: true
                });

                // Broadcast updated online users list
                this.broadcastOnlineUsers();

                // Handle messages
                ws.on('message', async (data) => {
                    try {
                        const message = JSON.parse(data);
                        await this.handleMessage(user.id, message);
                    } catch (error) {
                        console.error('Error handling message:', error);
                    }
                });

                // Handle disconnection
                ws.on('close', () => {
                    this.connections.delete(user.id);
                    this.onlineUsers.delete(user.id);
                    this.broadcastOnlineUsers();
                });

            } catch (error) {
                console.error('WebSocket connection error:', error);
                ws.close();
            }
        });
    }

    async validateToken(token) {
        try {
            // Use your existing JWT validation logic
            const Account = db.Account;
            const decoded = jwt.verify(token, config.secret);
            return await Account.findById(decoded.id);
        } catch {
            return null;
        }
    }

    broadcastOnlineUsers() {
        const onlineUsersList = Array.from(this.onlineUsers.values());
        const message = JSON.stringify({
            type: 'online_users',
            users: onlineUsersList
        });

        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    async handleMessage(senderId, message) {
        switch (message.type) {
            case 'chat_message':
                await this.handleChatMessage(senderId, message);
                break;
            // Add other message types as needed
        }
    }

    async handleChatMessage(senderId, message) {
        const { recipientId, content } = message;
        
        // Save message to database
        const Chat = db.Chat;
        const savedMessage = await Chat.create({
            senderId,
            recipientId,
            content,
            timestamp: new Date()
        });

        // Send to recipient if online
        const recipientWs = this.connections.get(recipientId);
        if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
            recipientWs.send(JSON.stringify({
                type: 'chat_message',
                message: savedMessage
            }));
        }

        // Send confirmation to sender
        const senderWs = this.connections.get(senderId);
        if (senderWs && senderWs.readyState === WebSocket.OPEN) {
            senderWs.send(JSON.stringify({
                type: 'message_sent',
                message: savedMessage
            }));
        }
    }

    getOnlineUsers() {
        return Array.from(this.onlineUsers.values());
    }
}

// GET /api/chat/messages/:chatId
router.get('/messages/:chatId', async (req, res) => {
  try {
    const [user1, user2] = req.params.chatId.split('-');
    if (!user1 || !user2) return res.status(400).json({ error: 'Invalid chatId' });

    const messages = await Chat.find({
      $or: [
        { senderId: user1, recipientId: user2 },
        { senderId: user2, recipientId: user1 }
      ]
    }).sort({ timestamp: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/unread/:userId
router.get('/unread/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const unreadChats = await Chat.find({ recipientId: userId, read: false });
    res.json(unreadChats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/markAsRead
router.post('/markAsRead', async (req, res) => {
  try {
    const { senderId, recipientId } = req.body;
    await Chat.updateMany({ senderId, recipientId, read: false }, { $set: { read: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { WebSocketService, router }; 