const express = require('express');
const router = express.Router();
const accountService = require('../accounts/account.service');
const authenticate = require('../_middleware/authenticate');
const Role = require('../_helpers/role');
const db = require('../_helpers/db');

// routes
router.get('/settings', authenticate(Role.Admin), getSettings);
router.post('/cleanup-sessions', authenticate(Role.Admin), cleanupSessions);
router.post('/update-cleanup-schedule', authenticate(Role.Admin), updateCleanupSchedule);
router.get('/cleanup-history', authenticate(Role.Admin), getCleanupHistory);
router.delete('/cleanup-history/:id', authenticate(Role.Admin), deleteCleanupRecord);

module.exports = router;

let lastCleanupTime = null;
let nextScheduledCleanup = null;

async function getSettings(req, res, next) {
    try {
        // Get active session count
        let activeSessions = { sessions: [] };
        try {
            activeSessions = await accountService.getActiveSessions({ page: 1, pageSize: 1000 });
        } catch (error) {
            console.error('Error fetching active sessions:', error);
            // Continue execution even if this fails
        }

        // Get the most recent cleanup from history
        const latestCleanup = await db.CleanupHistory.findOne()
            .sort({ timestamp: -1 })
            .limit(1);

        if (latestCleanup) {
            lastCleanupTime = latestCleanup.timestamp;
        }

        res.json({
            lastSessionCleanup: lastCleanupTime ? lastCleanupTime.toISOString() : null,
            nextScheduledCleanup: nextScheduledCleanup ? nextScheduledCleanup.toISOString() : null,
            activeSessionCount: activeSessions.sessions ? activeSessions.sessions.length : 0,
            cleanupSchedule: '0 0 * * *' // Daily at midnight
        });
    } catch (error) {
        next(error);
    }
}

async function cleanupSessions(req, res, next) {
    try {
        const startTime = Date.now();
        const result = await accountService.cleanupRefreshTokens();
        const executionTime = Date.now() - startTime;

        lastCleanupTime = new Date();
        // Calculate next cleanup based on schedule
        nextScheduledCleanup = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

        // Record the cleanup in history
        const cleanupRecord = new db.CleanupHistory({
            timestamp: lastCleanupTime,
            executedBy: req.user.id,
            executedByEmail: req.user.email,
            sessionsCleaned: result.deletedCount || 0,
            tokensRevoked: result.revokedCount || 0,
            executionTime: executionTime,
            result: result.message,
            isAutomatic: false,
            ipAddress: req.ip
        });

        await cleanupRecord.save();

        res.json({
            message: result.message,
            lastCleanup: lastCleanupTime.toISOString(),
            nextScheduledCleanup: nextScheduledCleanup.toISOString()
        });
    } catch (error) {
        next(error);
    }
}

async function updateCleanupSchedule(req, res, next) {
    try {
        const { schedule } = req.body;
        if (!schedule) {
            return res.status(400).json({ message: 'Schedule is required' });
        }

        // Validate schedule format here if needed

        // Update next scheduled cleanup
        nextScheduledCleanup = new Date(schedule);

        res.json({
            message: 'Cleanup schedule updated successfully',
            nextScheduledCleanup: nextScheduledCleanup.toISOString()
        });
    } catch (error) {
        next(error);
    }
}

async function getCleanupHistory(req, res, next) {
    try {
        // Set default limit to 20 records, max 100
        const limit = Math.min(parseInt(req.query.limit || 20), 100);
        const skip = parseInt(req.query.skip || 0);

        const history = await db.CleanupHistory.find()
            .sort({ timestamp: -1 })  // Newest first
            .skip(skip)
            .limit(limit);

        // Get total count for pagination
        const total = await db.CleanupHistory.countDocuments();

        res.json({
            history,
            pagination: {
                total,
                limit,
                skip,
                hasMore: total > (skip + limit)
            }
        });
    } catch (error) {
        next(error);
    }
}

async function deleteCleanupRecord(req, res, next) {
    try {
        if (!db.isValidId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid record ID' });
        }

        const result = await db.CleanupHistory.findByIdAndDelete(req.params.id);
        if (!result) {
            return res.status(404).json({ message: 'Record not found' });
        }

        res.json({ message: 'Cleanup history record deleted successfully' });
    } catch (error) {
        next(error);
    }
} 