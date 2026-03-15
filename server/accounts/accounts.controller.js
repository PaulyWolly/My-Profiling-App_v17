const express = require('express');
const router = express.Router();
console.log('[!!!] Loading accounts.controller.js...');
const authenticate = require('../_middleware/authenticate');
const { validateAuth0Token } = require('../_middleware/auth0');
const { upload, uploadProfileImage, uploadFollowerImage } = require('../uploads/upload.controller');
const accountService = require('./account.service');
const Joi = require('joi');
const validateRequest = require('../_middleware/validate-request');
const Role = require('../_helpers/role');
const db = require('../_helpers/db');
const fs = require('fs').promises;
const path = require('path');
const Account = require('./account.model');
const websocketService = require('../services/websocket.service');

console.log('Setting up accounts routes...');

// authentication routes
router.post('/authenticate', authenticateSchema, handleAuthenticate);
router.post('/auth0/authenticate', validateAuth0Token, handleAuth0Authenticate);
router.post('/refresh-token', refreshToken);
router.post('/revoke-token', authenticate(), revokeTokenSchema, revokeToken);
router.post('/register', registerSchema, register);
router.post('/verify-email', verifyEmailSchema, verifyEmail);
router.post('/forgot-password', forgotPasswordSchema, forgotPassword);
router.post('/validate-reset-token', validateResetTokenSchema, validateResetToken);
router.post('/reset-password', resetPasswordSchema, resetPassword);

// account routes
router.get('/active-sessions', getActiveSessions);
router.get('/', authenticate(), getAll);

// List all active sessions for the current user
router.get('/my-sessions', authenticate(), async (req, res, next) => {
    console.log('\n[MySessions] ===== Route handler entered =====');
    console.log('[MySessions] Request details:', {
        method: req.method,
        path: req.path,
        originalUrl: req.originalUrl,
        headers: {
            authorization: req.headers.authorization ? 'Bearer [REDACTED]' : 'none',
            cookie: req.headers.cookie ? 'present' : 'none'
        },
        user: req.user ? {
            id: req.user.id,
            email: req.user.email,
            role: req.user.role
        } : 'none'
    });

    try {
        console.log('[MySessions] Checking db and RefreshToken model...');
        console.log('[MySessions] db:', db ? 'defined' : 'undefined');
        console.log('[MySessions] db.RefreshToken:', db.RefreshToken ? 'defined' : 'undefined');

        if (!req.user) {
            console.error('[MySessions] Authentication failed - req.user is undefined');
            return res.status(401).json({ message: 'Authentication required' });
        }

        const userId = req.user.id;
        console.log('[MySessions] userId:', userId);

        console.log('[MySessions] Querying RefreshToken collection...');
        const sessions = await db.RefreshToken.find({
            account: userId,
            revoked: null,
            expires: { $gt: new Date() }
        }).sort({ created: -1 });

        console.log('[MySessions] Query complete. Found sessions:', sessions.length);

        const response = sessions.map(session => ({
            id: session.id,
            ip: session.createdByIp,
            created: session.created,
            expires: session.expires,
            lastActivity: session.updated,
            status: session.revoked ? 'Revoked' : (session.expires > new Date() ? 'Active' : 'Expired'),
            isCurrent: req.cookies.refreshToken === session.token,
            browser: session.browser || 'Unknown'
        }));

        console.log('[MySessions] Sending response with', response.length, 'sessions');
        res.json(response);
    } catch (error) {
        console.error('[MySessions] Error:', error);
        console.error('[MySessions] Error stack:', error.stack);
        next(error);
    }
});

// Revoke a specific session for the current user
router.post('/my-sessions/:sessionId/revoke', authenticate(), async (req, res, next) => {
    try {
        const userId = req.user.id;
        const sessionId = req.params.sessionId;
        const session = await db.RefreshToken.findById(sessionId);
        if (!session || String(session.account) !== String(userId)) {
            console.log(`[Revoke] Session not found or does not belong to user. userId=${userId}, sessionId=${sessionId}`);
            return res.status(404).json({ message: 'Session not found' });
        }
        session.revoked = new Date();
        session.revokedByIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
        session.revokedReason = 'User revoked from My Sessions';
        await session.save();
        console.log(`[Revoke] Session revoked. sessionId=${sessionId}, userId=${userId}, revokedAt=${session.revoked}`);
        res.json({ message: 'Session revoked successfully' });
    } catch (error) {
        console.error('[Revoke] Error revoking session:', error);
        next(error);
    }
});

router.get('/:id', authenticate(), getById);
router.post('/', authenticate(), createSchema, create);
router.put('/:id', authenticate(), updateSchema, update);
router.delete('/:id', authenticate(), _delete);

// Configure upload route with proper error handling
router.post('/upload-profile-image',
    authenticate(),
    (req, res, next) => {
        upload.single('profileImage')(req, res, (err) => {
            if (err) {
                console.error('Upload middleware error:', err);
                return res.status(400).json({ message: err.message });
            }
            next();
        });
    },
    (req, res, next) => {
        console.log('Processing upload request:', {
            file: req.file ? {
                filename: req.file.filename,
                mimetype: req.file.mimetype,
                size: req.file.size
            } : null,
            user: req.user?.id,
            email: req.body.userEmail
        });
        uploadProfileImage(req, res, next);
    }
);

// Add follower image upload route
router.post('/upload-follower-image',
    authenticate(),
    upload.single('file'),  // Use multer middleware directly
    async (req, res, next) => {
        console.log('Processing follower upload request:', {
            file: req.file ? {
                filename: req.file.filename,
                mimetype: req.file.mimetype,
                size: req.file.size
            } : null,
            user: req.user?.id,
            followerName: req.body.followerName
        });

        try {
            await uploadFollowerImage(req, res, next);
        } catch (error) {
            console.error('Error in upload follower image route:', error);
            res.status(500).json({ message: 'Server error during upload' });
        }
    }
);

// Add new route for cleaning up tokens (requires Admin role)
router.delete('/refresh-tokens/cleanup', authenticate(Role.Admin), cleanupTokensHandler);

// New routes for force logout and session cleanup
router.post('/force-logout/:id', authenticate(Role.Admin), forceLogoutHandler);
router.post('/force-logout-bulk', authenticate(Role.Admin), forceLogoutBulkHandler);
router.post('/cleanup-all-sessions', authenticate(Role.Admin), cleanupAllSessionsHandler);
// Add backward-compatible route for /sessions/:sessionId/force-logout
router.post('/sessions/:sessionId/force-logout', authenticate(Role.Admin), (req, res, next) => forceLogoutHandler({ ...req, params: { id: req.params.sessionId } }, res, next));

// Add this route after your other routes
router.post('/:id/fix-profile-image', authenticate(), async (req, res, next) => {
    try {
        const account = await db.Account.findById(req.params.id);
        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }

        if (!account.profileImage) {
            return res.status(400).json({ message: 'No profile image to fix' });
        }

        // Re-upload the image to trigger the fix
        const result = await accountService.uploadImage(account.id, account.profileImage);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Add migration route
router.post('/migrate-images', authenticate(Role.Admin), async (req, res, next) => {
    try {
        console.log('[AccountsController] Starting image migration');
        const accounts = await Account.find();
        const results = [];

        for (const account of accounts) {
            if (account.profileImage) {
                const oldPath = path.join(__dirname, '..', 'uploads', 'profiles', account.profileImage);
                const newFilename = `profileImage-${account.email}${path.extname(account.profileImage)}`;
                const newPath = path.join(__dirname, '..', 'uploads', 'profiles', newFilename);

                try {
                    // Check if old file exists
                    await fs.access(oldPath);
                    // Rename the file
                    await fs.rename(oldPath, newPath);
                    // Update the database
                    account.profileImage = newFilename;
                    await account.save();
                    results.push({ email: account.email, success: true, newPath: newFilename });
                } catch (error) {
                    results.push({ email: account.email, success: false, error: error.message });
                }
            }

            // Handle follower images if they exist
            if (account.followerImages && account.followerImages.length > 0) {
                for (const followerImage of account.followerImages) {
                    if (followerImage.path) {
                        const oldPath = path.join(__dirname, '..', 'uploads', 'followers', followerImage.path);
                        const newFilename = `followerImage-${account.email}${path.extname(followerImage.path)}`;
                        const newPath = path.join(__dirname, '..', 'uploads', 'followers', newFilename);

                        try {
                            // Check if old file exists
                            await fs.access(oldPath);
                            // Rename the file
                            await fs.rename(oldPath, newPath);
                            // Update the database
                            followerImage.path = newFilename;
                            followerImage.imageUrl = `/uploads/followers/${newFilename}`;
                            await account.save();
                            results.push({ email: account.email, type: 'follower', success: true, newPath: newFilename });
                        } catch (error) {
                            results.push({ email: account.email, type: 'follower', success: false, error: error.message });
                        }
                    }
                }
            }
        }

        res.json({
            message: 'Image migration completed',
            results: results
        });
    } catch (error) {
        next(error);
    }
});

// Add check-image-paths route before module.exports
router.get('/check-image-paths', authenticate(Role.Admin), async (req, res, next) => {
    try {
        console.log('[AccountsController] Checking image paths');
        await accountService.logAllImagePaths();
        res.json({ message: 'Image paths checked and logged' });
    } catch (error) {
        next(error);
    }
});

// Add logout route to revoke current session
router.post('/logout', authenticate(), async (req, res, next) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
        if (!refreshToken) {
            return res.status(400).json({ message: 'No refresh token found in cookies.' });
        }
        await accountService.revokeToken({ token: refreshToken, ipAddress });
        res.clearCookie('refreshToken');
        res.json({ message: 'Logged out and session revoked.' });
    } catch (error) {
        next(error);
    }
});

// Add Super-Admin password reset route
router.post('/:id/reset-password', authenticate(Role.SuperAdmin), async (req, res, next) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword) {
            return res.status(400).json({ message: 'New password is required' });
        }

        const result = await accountService.resetPasswordForSuperAdmin(req.params.id, newPassword);
        res.json({ message: 'Password reset successfully', newPassword: result.tempPassword });
    } catch (error) {
        next(error);
    }
});

// Add Super-Admin get password route
router.get('/:id/password', authenticate(Role.SuperAdmin), async (req, res, next) => {
    try {
        const result = await accountService.getPasswordForSuperAdmin(req.params.id);
        res.json({ password: result.password });
    } catch (error) {
        next(error);
    }
});

// Print all registered routes before export
console.log('\n[ACCOUNTS CONTROLLER] Registered routes:');
router.stack.forEach(r => {
    if (r.route) {
        console.log(`[ACCOUNTS ROUTE] ${r.route.stack[0].method.toUpperCase()} ${r.route.path}`);
    }
});
console.log('\n');

module.exports = router;

function authenticateSchema(req, res, next) {
    const schema = Joi.object({
        email: Joi.string().required(),
        password: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

function setTokenCookie(res, token) {
    const cookieOptions = {
        httpOnly: true,
        expires: new Date(Date.now() + 7*24*60*60*1000)
    };
    res.cookie('refreshToken', token, cookieOptions);
}

function handleAuthenticate(req, res, next) {
    const { email, password } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    accountService.authenticate({ email, password, ipAddress, userAgent })
        .then(({ jwtToken, refreshToken, ...account }) => {
            setTokenCookie(res, refreshToken);
            res.json({ jwtToken, refreshToken, ...account });
        })
        .catch(error => {
            console.error('Login error:', error);
            next(error);
        });
}

function refreshToken(req, res, next) {
    const token = req.cookies.refreshToken;
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
    accountService.refreshToken({ token, ipAddress })
        .then(({ jwtToken, refreshToken, ...account }) => {
            setTokenCookie(res, refreshToken);
            res.json({ jwtToken, refreshToken, ...account });
        })
        .catch(next);
}

function revokeTokenSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().empty('')
    });
    validateRequest(req, next, schema);
}

function revokeToken(req, res, next) {
    const token = req.body.token;
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;

    if (!token) return res.status(400).json({ message: 'Token is required' });

    if (!req.user.ownsToken(token)) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    accountService.revokeToken({ token, ipAddress })
        .then(() => res.json({ message: 'Token revoked' }))
        .catch(next);
}

function registerSchema(req, res, next) {
    const schema = Joi.object({
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
        acceptTerms: Joi.boolean().valid(true).required()
    });
    validateRequest(req, next, schema);
}

function register(req, res, next) {
    accountService.register(req.body, req.get('origin'))
        .then(() => res.json({ message: 'Registration successful, please check your email for verification instructions' }))
        .catch(next);
}

function verifyEmailSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

function verifyEmail(req, res, next) {
    accountService.verifyEmail(req.body)
        .then(() => res.json({ message: 'Verification successful, you can now login' }))
        .catch(next);
}

function forgotPasswordSchema(req, res, next) {
    const schema = Joi.object({
        email: Joi.string().email().required()
    });
    validateRequest(req, next, schema);
}

function forgotPassword(req, res, next) {
    accountService.forgotPassword(req.body, req.get('origin'))
        .then(() => res.json({ message: 'Please check your email for password reset instructions' }))
        .catch(next);
}

function validateResetTokenSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

function validateResetToken(req, res, next) {
    accountService.validateResetToken(req.body)
        .then(() => res.json({ message: 'Token is valid' }))
        .catch(next);
}

function resetPasswordSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required()
    });
    validateRequest(req, next, schema);
}

function resetPassword(req, res, next) {
    accountService.resetPassword(req.body)
        .then(() => res.json({ message: 'Password reset successful, you can now login' }))
        .catch(next);
}

function getAll(req, res, next) {
    accountService.getAll()
        .then(accounts => res.json(accounts))
        .catch(next);
}

function getById(req, res, next) {
    if (req.params.id !== req.user.id && req.user.role !== Role.Admin && req.user.role !== Role.SuperAdmin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    accountService.getById(req.params.id)
        .then(account => account ? res.json(account) : res.sendStatus(404))
        .catch(next);
}

function createSchema(req, res, next) {
    const schema = Joi.object({
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
        role: Joi.string().valid(Role.Admin, Role.User).required(),
        profileImage: Joi.string().allow('', null)
    });
    validateRequest(req, next, schema);
}

function create(req, res, next) {
    accountService.create(req.body)
        .then(account => res.json(account))
        .catch(next);
}

function updateSchema(req, res, next) {
    const schemaRules = {
        firstName: Joi.string().empty(''),
        lastName: Joi.string().empty(''),
        email: Joi.string().email().empty(''),
        password: Joi.string().min(6).empty(''),
        confirmPassword: Joi.string().valid(Joi.ref('password')).empty(''),

        // Profile template
        profileTemplateType: Joi.string().valid('STANDARD', 'BUSINESS_CARD', 'SOCIAL_MEDIA').empty(''),

        // Personal & Professional Details
        position: Joi.string().empty(''),
        company: Joi.string().empty(''),
        address: Joi.string().empty(''),
        city: Joi.string().empty(''),
        state: Joi.string().empty(''),
        zipCode: Joi.string().empty(''),
        phone: Joi.string().empty(''),
        mobile: Joi.string().empty(''),
        bio: Joi.string().empty(''),

        // Social Media Links
        website: Joi.string().allow('', null),
        github: Joi.string().empty(''),
        twitter: Joi.string().empty(''),
        instagram: Joi.string().empty(''),
        facebook: Joi.string().empty(''),
        linkedin: Joi.string().uri().empty(''),

        // Social Media Stats
        followersCount: Joi.number().integer().min(0).empty(''),
        followingCount: Joi.number().integer().min(0).empty(''),

        // Professional Skills - allow array of strings
        skills: Joi.alternatives().try(
            Joi.array().items(Joi.string()),
            Joi.string()
        ).empty(''),

        // Follower images
        followerImages: Joi.array().items(
            Joi.object({
                id: Joi.string().required(),
                name: Joi.string().required(),
                title: Joi.string().allow('', null),
                imageUrl: Joi.string().allow('', null),
                path: Joi.string().allow('', null)
            })
        ).optional(),

        // Role field - always allow it in schema but validate in update handler
        role: Joi.string().valid(Role.Admin, Role.User).empty('')
    };

    const schema = Joi.object(schemaRules).with('password', 'confirmPassword');
    validateRequest(req, next, schema);
}

function update(req, res, next) {
    // Log the update request
    console.log('[AccountsController] Update request received:', {
        requesterId: req.user.id,
        targetId: req.params.id,
        requesterRole: req.user.role,
        requestedUpdates: Object.keys(req.body)
    });

    // Check if user is authorized to update this account
    if (req.params.id !== req.user.id && req.user.role !== Role.Admin && req.user.role !== Role.SuperAdmin) {
        console.log('[AccountsController] Unauthorized update attempt:', {
            requesterId: req.user.id,
            targetId: req.params.id,
            requesterRole: req.user.role
        });
        return res.status(401).json({
            message: 'Unauthorized: Only admins can update other accounts',
            error: 'UNAUTHORIZED_UPDATE'
        });
    }

    // Check if attempting to modify a Super-Admin account
    if (req.params.id !== req.user.id) {
        // Get the target account to check its role
        accountService.getAccount(req.params.id)
            .then(targetAccount => {
                // If target is Super-Admin and requester is not Super-Admin, block the update
                if (targetAccount.role === Role.SuperAdmin && req.user.role !== Role.SuperAdmin) {
                    console.log('[AccountsController] Super-Admin modification blocked:', {
                        targetId: req.params.id,
                        targetRole: targetAccount.role,
                        requesterId: req.user.id,
                        requesterRole: req.user.role
                    });
                    return res.status(403).json({
                        message: 'Unauthorized: Only Super-Admin can modify Super-Admin accounts',
                        error: 'SUPER_ADMIN_MODIFICATION_BLOCKED'
                    });
                }

                // Proceed with the update if authorized
                proceedWithUpdate(req, res, next);
            })
            .catch(error => {
                console.error('[AccountsController] Error checking target account role:', error);
                return res.status(500).json({
                    message: 'Internal server error while checking permissions',
                    error: 'ACCOUNT_CHECK_FAILED'
                });
            });
    } else {
        // User is updating their own account, proceed
        proceedWithUpdate(req, res, next);
    }
}

function proceedWithUpdate(req, res, next) {
    // Handle role updates
    if (req.body.role) {
        // Only Super-Admin can change roles to Super-Admin
        if (req.body.role === Role.SuperAdmin && req.user.role !== Role.SuperAdmin) {
            console.log('[AccountsController] Attempted Super-Admin role assignment blocked:', {
                userId: req.params.id,
                requesterRole: req.user.role
            });
            return res.status(403).json({
                message: 'Only Super-Admin can assign Super-Admin role',
                error: 'SUPER_ADMIN_ROLE_ASSIGNMENT_BLOCKED'
            });
        }

        // Only admins can change roles
        if (req.user.role !== Role.Admin && req.user.role !== Role.SuperAdmin) {
            console.log('[AccountsController] Attempted role escalation blocked:', {
                userId: req.params.id,
                requesterRole: req.user.role,
                attemptedRole: req.body.role
            });
            return res.status(403).json({
                message: 'Attempted role escalation blocked: Non-admin user tried to set role to ' + req.body.role,
                error: 'ROLE_ESCALATION_BLOCKED'
            });
        }

        // Validate role value
        if (![Role.Admin, Role.User, Role.SuperAdmin].includes(req.body.role)) {
            console.log('[AccountsController] Invalid role value:', {
                userId: req.params.id,
                invalidRole: req.body.role
            });
            return res.status(400).json({
                message: 'Invalid role value. Must be either "Admin", "Super-Admin", or "User"',
                error: 'INVALID_ROLE'
            });
        }
    }

    // Proceed with update
    accountService.update(req.params.id, req.body)
        .then(account => {
            console.log('[AccountsController] Account updated successfully:', {
                id: account.id,
                email: account.email,
                role: account.role
            });
            res.json(account);
        })
        .catch(error => {
            console.error('[AccountsController] Update failed:', {
                userId: req.params.id,
                error: error.message || error
            });
            next(error);
        });
}

function _delete(req, res, next) {
    if (req.params.id !== req.user.id && req.user.role !== Role.Admin && req.user.role !== Role.SuperAdmin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    // Check if attempting to delete a Super-Admin account
    if (req.params.id !== req.user.id) {
        // Get the target account to check its role
        accountService.getAccount(req.params.id)
            .then(targetAccount => {
                // If target is Super-Admin and requester is not Super-Admin, block the deletion
                if (targetAccount.role === Role.SuperAdmin && req.user.role !== Role.SuperAdmin) {
                    console.log('[AccountsController] Super-Admin deletion blocked:', {
                        targetId: req.params.id,
                        targetRole: targetAccount.role,
                        requesterId: req.user.id,
                        requesterRole: req.user.role
                    });
                    return res.status(403).json({
                        message: 'Unauthorized: Only Super-Admin can delete Super-Admin accounts',
                        error: 'SUPER_ADMIN_DELETION_BLOCKED'
                    });
                }

                // Proceed with the deletion if authorized
                accountService.delete(req.params.id)
                    .then(() => res.json({ message: 'Account deleted successfully' }))
                    .catch(next);
            })
            .catch(error => {
                console.error('[AccountsController] Error checking target account role for deletion:', error);
                return res.status(500).json({
                    message: 'Internal server error while checking permissions',
                    error: 'ACCOUNT_CHECK_FAILED'
                });
            });
    } else {
        // User is deleting their own account, proceed
        accountService.delete(req.params.id)
            .then(() => res.json({ message: 'Account deleted successfully' }))
            .catch(next);
    }
}

// helper functions

// New handler function for the active sessions route
async function getActiveSessions(req, res, next) {
    // Extract pagination params from query string, provide defaults
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 10;

    try {
        console.log(`[AccountsController] Request received for active sessions - Page: ${page}, Size: ${pageSize}`);
        // Call the updated service function with pagination params
        const result = await accountService.getActiveSessions({ page, pageSize });
        console.log(`[AccountsController] Sending response with ${result.sessions.length} sessions and pagination info`);
        res.json(result); // Send the structured response { sessions: [...], pagination: {...} }
    } catch (error) {
        console.error('[AccountsController] Error in getActiveSessions route handler:', error);
        next(error); // Pass error to global error handler
    }
}

// New handler function for the token cleanup route
function cleanupTokensHandler(req, res, next) {
    console.log('[Backend - Controller] DELETE /accounts/refresh-tokens/cleanup called');
    accountService.cleanupRefreshTokens()
        .then(result => res.json(result))
        .catch(next);
}

// Handler for forcing logout of a single session
async function forceLogoutHandler(req, res, next) {
    try {
        const sessionId = req.params.id;
        const now = new Date();

        const result = await db.RefreshToken.findByIdAndUpdate(sessionId, {
            revoked: now,
            revokedByIp: req.ip,
            revokedReason: 'Admin force logout'
        });

        if (!result) {
            return res.status(404).json({ message: 'Session not found' });
        }

        // Remove the session from WebSocketService and broadcast updated online users
        if (websocketService && websocketService.connections && websocketService.connections.has(sessionId)) {
            const connection = websocketService.connections.get(sessionId);
            if (connection && connection.userId) {
                websocketService.handleDisconnection(sessionId, connection.userId);
            } else {
                websocketService.connections.delete(sessionId);
                websocketService.broadcastOnlineUsers();
            }
        } else {
            websocketService.broadcastOnlineUsers();
        }

        res.json({ message: 'Session revoked successfully' });
    } catch (error) {
        next(error);
    }
}

// Handler for forcing logout of multiple sessions
async function forceLogoutBulkHandler(req, res, next) {
    try {
        const { sessionIds } = req.body;
        if (!Array.isArray(sessionIds)) {
            return res.status(400).json({ message: 'sessionIds must be an array' });
        }

        const now = new Date();
        const result = await db.RefreshToken.updateMany(
            { _id: { $in: sessionIds } },
            {
                revoked: now,
                revokedByIp: req.ip,
                revokedReason: 'Admin bulk force logout'
            }
        );

        res.json({
            message: `Successfully revoked ${result.modifiedCount} sessions`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        next(error);
    }
}

// Handler for cleaning up all sessions
async function cleanupAllSessionsHandler(req, res, next) {
    try {
        const now = new Date();
        // Delete all sessions except the current one (no longer using cookies)
        const result = await db.RefreshToken.deleteMany({
            $or: [
                { expires: { $lt: now } },
                { revoked: { $ne: null } }
            ]
        });
        res.json({
            message: `Successfully cleaned up ${result.deletedCount} sessions`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        next(error);
    }
}

// Auth0 Authentication Handler
async function handleAuth0Authenticate(req, res, next) {
    try {
        if (!req.auth0User) {
            return res.status(401).json({ message: 'Auth0 authentication required' });
        }

        console.log('[Auth0] Authenticating user:', req.auth0User.email);
        console.log('[Auth0] User details:', {
            email: req.auth0User.email,
            name: req.auth0User.name,
            picture: req.auth0User.picture,
            sub: req.auth0User.sub
        });


        // Check if account exists
        const existingAccount = await accountService.getByEmail(req.auth0User.email);

        let account;
        if (existingAccount) {
            // Update existing account with Auth0 info
            // Preserve existing role unless it's a Super-Admin user
            const isSuperAdmin = req.auth0User.email === 'pwelby@pwconsulting.com' ||
                                req.auth0User.email === 'paul@pwconsulting.com';

            console.log('[Auth0] Existing account Super-Admin check:', {
                email: req.auth0User.email,
                sub: req.auth0User.sub,
                isSuperAdmin: isSuperAdmin,
                emailMatch: req.auth0User.email === 'pwelby@pwconsulting.com',
                existingRole: existingAccount.role
            });

            // Use the profile image as provided by Auth0
            let profileImageUrl = req.auth0User.picture;

            // Ensure the profile image URL is properly formatted
            if (profileImageUrl && !profileImageUrl.startsWith('http')) {
                profileImageUrl = `https://${profileImageUrl}`;
            }

            // For Google profile images, ensure we have the right parameters for display
            if (profileImageUrl && profileImageUrl.includes('googleusercontent.com')) {
                // Remove any existing size parameters and add proper ones for display
                profileImageUrl = profileImageUrl.replace(/=s\d+-c$/, '=s400-c');
                console.log('[Auth0] Enhanced Google profile image URL:', profileImageUrl);
            }

            // Determine auth provider from Auth0 user data
            const authProvider = req.auth0User.sub.startsWith('google-oauth2') ? 'google' : 'auth0';

            console.log('[Auth0] About to update account with profileImage:', profileImageUrl);
            console.log('[Auth0] Existing account profileImage before update:', existingAccount.profileImage);

            // Only update profileImage if we have a valid URL, otherwise keep existing
            const updateData = {
                ...existingAccount,
                auth0Id: req.auth0User.sub,
                authProvider: authProvider,
                verified: Date.now(), // Use timestamp instead of boolean
                role: isSuperAdmin ? 'Super-Admin' : existingAccount.role // Preserve existing role or set to Super-Admin
            };

            // Preserve local profile image if it exists, only use Auth0 image if no local image
            if (existingAccount.profileImage && 
                (existingAccount.profileImage.includes('/uploads/profiles/') || 
                 existingAccount.profileImage.includes('amazonaws.com') ||
                 existingAccount.profileImage.includes('s3.'))) {
                // Keep the existing local or S3 profile image
                console.log('[Auth0] Preserving existing profile image:', existingAccount.profileImage);
                updateData.profileImage = existingAccount.profileImage;
            } else if (profileImageUrl) {
                // Only use Auth0 image if no local image exists
                updateData.profileImage = profileImageUrl;
                console.log('[Auth0] No local profile image found, using Auth0 image:', profileImageUrl);
            } else if (!existingAccount.profileImage) {
                // If no existing profile image and none provided by Auth0, use default
                updateData.profileImage = '/assets/images/default-avatar.png';
                console.log('[Auth0] No profile image provided by Auth0 and none existing, using default avatar');
            } else {
                console.log('[Auth0] No profile image provided by Auth0, keeping existing:', existingAccount.profileImage);
            }

            account = await accountService.update(existingAccount.id, updateData);

            console.log('[Auth0] Account after update - profileImage:', account.profileImage);
            console.log('[Auth0] Updated existing account:', account.email);
        } else {
            // Create new account
            // Check if this is a Super-Admin user (you can customize this logic)
            const isSuperAdmin = req.auth0User.email === 'pwelby@pwconsulting.com' ||
                                req.auth0User.email === 'paul@pwconsulting.com';

            console.log('[Auth0] Super-Admin check:', {
                email: req.auth0User.email,
                sub: req.auth0User.sub,
                isSuperAdmin: isSuperAdmin,
                emailMatch: req.auth0User.email === 'pwelby@pwconsulting.com'
            });

            const roleToAssign = isSuperAdmin ? 'Super-Admin' : 'User';
            console.log('[Auth0] Assigning role:', roleToAssign);

            // Use the profile image as provided by Auth0
            let profileImageUrl = req.auth0User.picture;

            // Ensure the profile image URL is properly formatted
            if (profileImageUrl && !profileImageUrl.startsWith('http')) {
                profileImageUrl = `https://${profileImageUrl}`;
            }

            // For Google profile images, ensure we have the right parameters for display
            if (profileImageUrl && profileImageUrl.includes('googleusercontent.com')) {
                // Remove any existing size parameters and add proper ones for display
                profileImageUrl = profileImageUrl.replace(/=s\d+-c$/, '=s400-c');
                console.log('[Auth0] Enhanced Google profile image URL:', profileImageUrl);
            }

            // Determine auth provider from Auth0 user data
            const authProvider = req.auth0User.sub.startsWith('google-oauth2') ? 'google' : 'auth0';

            console.log('[Auth0] About to create new account with profileImage:', profileImageUrl);

            const newAccountData = {
                email: req.auth0User.email,
                firstName: req.auth0User.name?.split(' ')[0] || '',
                lastName: req.auth0User.name?.split(' ').slice(1).join(' ') || '',
                verified: Date.now(), // Use timestamp instead of boolean
                role: roleToAssign,
                auth0Id: req.auth0User.sub,
                authProvider: authProvider
                // Note: No password for Auth0 users
            };

            // Only include profileImage if we have a valid URL, otherwise use default
            if (profileImageUrl) {
                newAccountData.profileImage = profileImageUrl;
                console.log('[Auth0] Creating new account with profileImage:', profileImageUrl);
            } else {
                // Use a default avatar when no profile image is provided
                newAccountData.profileImage = '/assets/images/default-avatar.png';
                console.log('[Auth0] Creating new account with default avatar (none provided by Auth0)');
            }

            account = await accountService.register(newAccountData);

            console.log('[Auth0] New account created - profileImage:', account.profileImage);
            console.log('[Auth0] Created new account:', {
                email: account.email,
                role: account.role,
                profileImage: account.profileImage
            });
        }

        // Generate JWT token for the account
        const jwtToken = accountService.generateJwtToken(account);

        // Remove password hash from response
        const { passwordHash, ...accountWithoutPassword } = account;

        res.json({
            ...accountWithoutPassword,
            jwtToken
        });

    } catch (error) {
        console.error('[Auth0] Authentication error:', error);
        next(error);
    }
}
