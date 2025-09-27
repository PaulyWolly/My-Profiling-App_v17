const db = require('../_helpers/db');
const { WebSocket } = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../secrets/config.json');
const Chat = require('../models/chat.model');
const SessionInfo = require('../models/session-info.model');

class WebSocketService {
    constructor() {
        this.connections = new Map(); // sessionId -> { ws, userId }
        this.userSessions = new Map(); // userId -> Set of sessionIds
        this.onlineUsers = new Map(); // userId -> user info
        this.sessionStartTimes = new Map(); // sessionId -> Date
    }

    formatImageUrl(imagePath) {
        if (!imagePath) return null;

        // If it's already a full URL (starts with http), return it as-is
        if (imagePath.startsWith('http')) {
            return imagePath;
        }

        // Remove any leading slash
        const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
        // Ensure the path starts with uploads/profiles/ for local images only
        if (!cleanPath.startsWith('uploads/profiles/')) {
            return `uploads/profiles/${cleanPath}`;
        }
        return cleanPath;
    }

    initialize(server) {
        if (!server) {
            throw new Error('HTTP server instance required');
        }

        try {
            // Color codes
            const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
            const orange = (s) => `\x1b[38;5;208m${s}\x1b[0m`;
            const blue = (s) => `\x1b[34m${s}\x1b[0m`;

            // Start WebSocket log group
            console.log('\n--- WebSocket Server ---');

            this.wss = new WebSocket.Server({ server });
            console.log(yellow('WebSocket server created'));

            this.wss.on('connection', async (ws, req) => {
                try {
                    // Extract token and session ID from query params
                    const url = new URL(req.url, `http://${req.headers.host}`);
                    const token = url.searchParams.get('token');
                    const sessionId = url.searchParams.get('sessionId');
                    console.log('Token received:', token ? 'Yes' : 'No', 'SessionId:', sessionId);

                    if (!sessionId) {
                        console.log('No session ID provided, closing connection');
                        ws.close();
                        return;
                    }

                    // Validate token and get user
                    const user = await this.validateToken(token);
                    if (!user) {
                        console.log('Invalid token, closing connection');
                        ws.close();
                        return;
                    }

                    console.log('User authenticated:', user.email, 'Session:', sessionId);

                    // Store connection with session ID
                    this.connections.set(sessionId, { ws, userId: user.id });

                    // Track session for this user
                    if (!this.userSessions.has(user.id)) {
                        this.userSessions.set(user.id, new Set());
                    }
                    this.userSessions.get(user.id).add(sessionId);

                    // Track session start time and log login
                    const loginTime = new Date();
                    this.sessionStartTimes.set(sessionId, loginTime);
                    console.log(`[${loginTime.toISOString()}] [LOGIN] User: ${user.email} (ID: ${user.id}) logged in. Session: ${sessionId}`);

                    // Save session info to MongoDB
                    try {
                        await SessionInfo.create({
                            userId: user.id,
                            email: user.email,
                            sessionId,
                            loginTime
                        });
                    } catch (err) {
                        console.error('Error saving session info to MongoDB:', err);
                    }

                    // Update online users info
                    this.onlineUsers.set(user.id, {
                        id: user.id,
                        name: `${user.firstName} ${user.lastName}`,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        profileImage: this.formatImageUrl(user.profileImage),
                        isOnline: true,
                        sessionId: sessionId // Include session ID in user info
                    });

                    console.log('User sessions after adding:',
                        Array.from(this.userSessions.get(user.id) || []));

                    // Broadcast updated online users list
                    this.broadcastOnlineUsers();

                    // Handle messages
                    ws.on('message', async (data) => {
                        try {
                            const message = JSON.parse(data.toString());
                            console.log('Received message from', user.email, 'Session:', sessionId);
                            await this.handleMessage(user.id, sessionId, message);
                        } catch (error) {
                            console.error('Error handling message:', error);
                        }
                    });

                    // Handle disconnection
                    ws.on('close', async () => {
                        // Log logout and session duration
                        const startTime = this.sessionStartTimes.get(sessionId);
                        const endTime = new Date();
                        if (startTime) {
                            const durationMs = endTime - startTime;
                            const durationSec = Math.round(durationMs / 1000);
                            console.log(`[${endTime.toISOString()}] [LOGOUT] User: ${user.email} (ID: ${user.id}) logged out. Session: ${sessionId} Duration: ${durationSec} seconds`);
                            this.sessionStartTimes.delete(sessionId);
                            // Update session info in MongoDB
                            try {
                                await SessionInfo.findOneAndUpdate(
                                    { sessionId },
                                    { logoutTime: endTime, durationSec },
                                    { new: true }
                                );
                            } catch (err) {
                                console.error('Error updating session info in MongoDB:', err);
                            }
                        } else {
                            console.log(`[${endTime.toISOString()}] [LOGOUT] User: ${user.email} (ID: ${user.id}) logged out. Session: ${sessionId} (no start time found)`);
                        }
                        this.connections.delete(sessionId);
                        // Remove session from user's sessions
                        const userSessions = this.userSessions.get(user.id);
                        if (userSessions) {
                            userSessions.delete(sessionId);
                            // If user has no more sessions, remove from online users
                            if (userSessions.size === 0) {
                                this.userSessions.delete(user.id);
                                this.onlineUsers.delete(user.id);
                            }
                        }
                        this.broadcastOnlineUsers();
                    });

                    // Handle errors
                    ws.on('error', (error) => {
                        console.error('WebSocket error for session', sessionId, ':', error);
                        this.handleDisconnection(sessionId, user.id);
                    });

                } catch (error) {
                    console.error('WebSocket connection error:', error);
                    ws.close();
                }
            });

            console.log(orange('WebSocket server initialized successfully'));
            console.log(blue('WebSocket service initialized successfully'));
            // End WebSocket log group
            console.log('------------------------\n');
        } catch (error) {
            console.error('Failed to initialize WebSocket server:', error);
            throw error;
        }
    }

    async validateToken(token) {
        try {
            if (!token) {
                console.error('No token provided for WebSocket connection');
                return null;
            }

            // Use your existing JWT validation logic
            const Account = db.Account;
            const decoded = jwt.verify(token, config.secret);

            if (!decoded || !decoded.id) {
                console.error('Invalid token format - missing user ID');
                return null;
            }

            const user = await Account.findById(decoded.id);
            if (!user) {
                console.error('User not found for token:', decoded.id);
                return null;
            }

            console.log('Token validated successfully for user:', user.email);
            return user;
        } catch (error) {
            console.error('Token validation error:', error.message);
            return null;
        }
    }

    broadcastOnlineUsers() {
        const onlineUsersList = Array.from(this.onlineUsers.values());
        console.log('Broadcasting online users list:', onlineUsersList);

        const message = JSON.stringify({
            type: 'online_users',
            users: onlineUsersList
        });

        let sentCount = 0;
        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
                sentCount++;
            }
        });
        console.log(`Broadcast online users to ${sentCount} clients`);
    }

    async handleMessage(senderId, sessionId, message) {
        console.log('[WebSocket] Handling message:', { type: message.type, senderId, sessionId });

        switch (message.type) {
            case 'chat_message':
                await this.handleChatMessage(senderId, sessionId, message);
                break;
            case 'chat_request':
                await this.handleChatRequest(senderId, sessionId, message);
                break;
            default:
                console.log('[WebSocket] Unhandled message type:', message.type);
        }
    }

    async handleChatMessage(senderId, sessionId, message) {
        const { recipientId, content } = message;
        console.log('[WebSocket] Processing chat message:', { senderId, recipientId, content, sessionId });

        // Save message to database
        const savedMessage = await Chat.create({
            senderId,
            recipientId,
            content,
            timestamp: new Date()
        });
        console.log('[WebSocket] Saved message to database:', savedMessage);

        // Send to all recipient's sessions
        const recipientSessions = this.userSessions.get(recipientId);
        if (recipientSessions) {
            recipientSessions.forEach(recipientSessionId => {
                const connection = this.connections.get(recipientSessionId);
                if (connection && connection.ws.readyState === WebSocket.OPEN) {
                    console.log('[WebSocket] Sending message to recipient session:', recipientSessionId);
                    connection.ws.send(JSON.stringify({
                        type: 'chat_message',
                        message: savedMessage
                    }));
                } else {
                    console.log('[WebSocket] Recipient connection not available:', recipientSessionId);
                }
            });
        } else {
            console.log('[WebSocket] No active sessions found for recipient:', recipientId);
        }

        // Send to all sender's sessions
        const senderSessions = this.userSessions.get(senderId);
        if (senderSessions) {
            senderSessions.forEach(senderSessionId => {
                const connection = this.connections.get(senderSessionId);
                if (connection && connection.ws.readyState === WebSocket.OPEN) {
                    console.log('[WebSocket] Sending message to sender session:', senderSessionId);
                    connection.ws.send(JSON.stringify({
                        type: 'chat_message',
                        message: savedMessage
                    }));
                } else {
                    console.log('[WebSocket] Sender connection not available:', senderSessionId);
                }
            });
        } else {
            console.log('[WebSocket] No active sessions found for sender:', senderId);
        }
    }

    async handleChatRequest(senderId, sessionId, message) {
        const { recipientId } = message;
        console.log('[WebSocket] Handling chat request:', {
            senderId,
            recipientId,
            sessionId
        });

        const sender = await db.Account.findById(senderId);

        if (!sender) {
            console.error('Sender not found:', senderId);
            return;
        }

        // Find all WebSocket connections for the recipient
        const recipientConnections = Array.from(this.connections.entries())
            .filter(([_, connection]) => connection.userId === recipientId)
            .map(([_, connection]) => connection.ws);

        console.log('[WebSocket] Recipient connections:', {
            recipientId,
            connectionCount: recipientConnections.length,
            connections: recipientConnections.map(ws => ({
                readyState: ws.readyState,
                isOpen: ws.readyState === WebSocket.OPEN
            }))
        });

        // Only send chat_request to the recipient, never to the sender/initiator
        recipientConnections.forEach(ws => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                const requestMessage = {
                    type: 'chat_request',
                    recipientId,
                    sender: {
                        id: sender.id,
                        name: `${sender.firstName} ${sender.lastName}`,
                        firstName: sender.firstName,
                        lastName: sender.lastName,
                        profileImage: this.formatImageUrl(sender.profileImage),
                        isOnline: true
                    }
                };
                console.log('[WebSocket] Sending chat request to recipient userId:', recipientId, requestMessage);
                ws.send(JSON.stringify(requestMessage));
            }
        });
    }

    handleDisconnection(sessionId, userId) {
        this.connections.delete(sessionId);
        const userSessions = this.userSessions.get(userId);
        if (userSessions) {
            userSessions.delete(sessionId);
            if (userSessions.size === 0) {
                this.userSessions.delete(userId);
                this.onlineUsers.delete(userId);
            }
        }
        this.broadcastOnlineUsers();
    }

    getOnlineUsers() {
        return Array.from(this.onlineUsers.values());
    }

    // Update a user's profile image in the online users list
    updateUserProfileImage(userId, profileImage) {
        if (this.onlineUsers.has(userId)) {
            const userInfo = this.onlineUsers.get(userId);
            userInfo.profileImage = this.formatImageUrl(profileImage);
            this.onlineUsers.set(userId, userInfo);

            console.log(`[WebSocket] Updated profile image for user ${userId}:`, userInfo.profileImage);

            // Broadcast the updated online users list
            this.broadcastOnlineUsers();
        }
    }

    // Emit a 'new_post' event to all sessions of a recipient user
    emitNewPost(recipientId, post) {
        const recipientSessions = this.userSessions.get(recipientId);
        if (recipientSessions) {
            recipientSessions.forEach(sessionId => {
                const connection = this.connections.get(sessionId);
                if (connection && connection.ws.readyState === WebSocket.OPEN) {
                    connection.ws.send(JSON.stringify({
                        type: 'new_post',
                        post
                    }));
                }
            });
        }
    }
}

module.exports = new WebSocketService();
