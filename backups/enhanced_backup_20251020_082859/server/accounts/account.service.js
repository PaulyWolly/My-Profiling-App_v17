const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { secret } = require('../secrets/config.json');
const db = require('../_helpers/db');
const Role = require('../_helpers/role');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const UAParser = require('ua-parser-js');

module.exports = {
    authenticate,
    refreshToken,
    revokeToken,
    register,
    getAll,
    getById,
    getByEmail,
    create,
    update,
    delete: _delete,
    uploadImage,
    getActiveSessions,
    cleanupRefreshTokens,
    migrateAllLegacyImages,
    logAllImagePaths,
    generateJwtToken,
    resetPasswordForSuperAdmin,
    getPasswordForSuperAdmin,
    getAccount
};

async function authenticate({ email, password, ipAddress, userAgent }) {
    console.log('Authentication attempt:', { email, ipAddress });

    try {
        // Trim the email and convert to lowercase for consistent comparison
        const normalizedEmail = email.trim().toLowerCase();
        console.log('Searching for email (normalized):', normalizedEmail);

        // Use case-insensitive query
        const account = await db.Account.findOne({
            email: { $regex: new RegExp('^' + normalizedEmail + '$', 'i') }
        });
        console.log('Database query completed');

        if (!account) {
            console.log('No account found for email:', normalizedEmail);
            throw 'Email or password is incorrect';
        }

        console.log('Account found:', {
            id: account._id,
            email: account.email,
            verified: account.verified,
            role: account.role,
            passwordHash: account.passwordHash ? 'exists' : 'missing'
        });

        const passwordValid = bcrypt.compareSync(password, account.passwordHash);
        console.log('Password validation result:', passwordValid);

        if (!account.verified || !passwordValid) {
            console.log('Authentication failed:', {
                verified: account.verified,
                passwordValid
            });
            throw 'Email or password is incorrect';
        }

        // Revoke any existing active sessions for this user
        // await db.RefreshToken.updateMany(
        //     {
        //         account: account.id,
        //         revoked: null,
        //         expires: { $gt: new Date() }
        //     },
        //     {
        //         revoked: new Date(),
        //         revokedByIp: ipAddress,
        //         revokedReason: 'New login detected'
        //     }
        // );

        // Parse user-agent for a friendly browser string
        let friendlyBrowser = 'Unknown';
        if (userAgent && typeof userAgent === 'string') {
            const parser = new UAParser(userAgent);
            const os = parser.getOS();
            const browser = parser.getBrowser();
            const osString = os.name && os.version ? `${os.name} ${os.version}` : os.name || '';
            const browserString = browser.name && browser.version ? `${browser.name}/${browser.version}` : browser.name || '';
            friendlyBrowser = [osString, browserString].filter(Boolean).join(' ');
        }

        // authentication successful so generate jwt and refresh tokens
        console.log('Authentication successful, generating tokens');
        const jwtToken = generateJwtToken(account);
        const refreshToken = generateRefreshToken(account, ipAddress, userAgent, friendlyBrowser);

        // save refresh token
        await refreshToken.save();
        console.log('Refresh token saved');

        const response = {
            ...basicDetails(account),
            jwtToken,
            refreshToken: refreshToken.token
        };
        console.log('Authentication response prepared:', {
            id: response.id,
            email: response.email,
            role: response.role,
            hasJwtToken: !!response.jwtToken,
            hasRefreshToken: !!response.refreshToken
        });

        return response;
    } catch (error) {
        console.error('Authentication error:', error);
        throw error;
    }
}

async function refreshToken({ token, ipAddress }) {
    const refreshToken = await getRefreshToken(token);
    const account = await getAccount(refreshToken.account);

    // Do NOT revoke or replace the refresh token on use
    // Only generate a new JWT
    const jwtToken = generateJwtToken(account);

    // return basic details and tokens
    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: refreshToken.token
    };
}

async function revokeToken({ token, ipAddress }) {
    const refreshToken = await getRefreshToken(token);

    // revoke token and save
    refreshToken.revoked = new Date();
    refreshToken.revokedByIp = ipAddress;
    refreshToken.revokedReason = 'User logout';
    await refreshToken.save();
}

async function register(params, origin) {
    // validate
    if (await db.Account.findOne({ email: params.email })) {
        // Just throw an error instead of sending email
        throw 'Email "' + params.email + '" is already registered';
    }

    // Handle temp profile image renaming
    if (params.profileImage && params.profileImage.includes('tempProfileImage-')) {
        try {
            const email = params.email;
            const extension = path.extname(params.profileImage) || '.png';
            const safeEmail = email.replace(/[^a-zA-Z0-9@.]/g, '_');
            const tempFilename = `tempProfileImage-${safeEmail}${extension}`;
            const finalFilename = `profileImage-${safeEmail}${extension}`;
            const tempPath = path.join(__dirname, '..', 'uploads', 'profiles', tempFilename);
            const finalPath = path.join(__dirname, '..', 'uploads', 'profiles', finalFilename);

            // Rename tempProfileImage-<email>.<ext> to profileImage-<email>.<ext>
            if (fsSync.existsSync(tempPath)) {
                if (fsSync.existsSync(finalPath)) {
                    await fs.unlink(finalPath);
                }
                await fs.rename(tempPath, finalPath);
                params.profileImage = `/uploads/profiles/${finalFilename}`;
            }

            // Clean up any temp_<timestamp>.<ext> files for this extension
            const files = fsSync.readdirSync(path.join(__dirname, '..', 'uploads', 'profiles'));
            files.forEach(f => {
                if (
                    f.startsWith('temp_') &&
                    f.endsWith(extension) &&
                    f !== tempFilename
                ) {
                    fsSync.unlinkSync(path.join(__dirname, '..', 'uploads', 'profiles', f));
                }
            });
        } catch (err) {
            console.error('[AccountService] Error renaming temp profile image:', err);
            params.profileImage = null;
        }
    }

    // create account object
    const account = new db.Account(params);

    // Ensure role is provided and valid
    if (!params.role || ![Role.Admin, Role.User, Role.SuperAdmin].includes(params.role)) {
        console.log('Invalid role provided:', params.role);
        throw 'Role must be either "Admin", "User", or "Super-Admin"';
    }

    console.log('Setting account role:', params.role);

    account.verificationToken = randomTokenString();

    // hash password (only if provided - Auth0 users don't have passwords)
    if (params.password) {
        account.passwordHash = hash(params.password);
        account.plainPassword = params.password; // Store plain text for Super-Admin access
    } else {
        // For Auth0 users, set a random password hash that will never be used
        const randomPassword = 'auth0-user-' + Date.now() + '-' + Math.random();
        account.passwordHash = hash(randomPassword);
        account.plainPassword = randomPassword; // Store the random password
    }

    // save account
    await account.save();

    console.log('Account saved with role:', account.role);
    return account;
}

async function getAll() {
    const accounts = await db.Account.find();
    return accounts.map(x => basicDetails(x));
}

async function getById(id) {
    const account = await getAccount(id);
    return basicDetails(account);
}

async function getByEmail(email) {
    const account = await db.Account.findOne({ email });
    return account ? basicDetails(account) : null;
}

async function create(params) {
    // validate
    if (await db.Account.findOne({ email: params.email })) {
        throw 'Email "' + params.email + '" is already registered';
    }

    // Handle temp profile image renaming
    if (params.profileImage && params.profileImage.includes('tempProfileImage-')) {
        try {
            const email = params.email;
            const extension = path.extname(params.profileImage) || '.png';
            const safeEmail = email.replace(/[^a-zA-Z0-9@.]/g, '_');
            const tempFilename = `tempProfileImage-${safeEmail}${extension}`;
            const finalFilename = `profileImage-${safeEmail}${extension}`;
            const tempPath = path.join(__dirname, '..', 'uploads', 'profiles', tempFilename);
            const finalPath = path.join(__dirname, '..', 'uploads', 'profiles', finalFilename);

            // Rename tempProfileImage-<email>.<ext> to profileImage-<email>.<ext>
            if (fsSync.existsSync(tempPath)) {
                if (fsSync.existsSync(finalPath)) {
                    await fs.unlink(finalPath);
                }
                await fs.rename(tempPath, finalPath);
                params.profileImage = `/uploads/profiles/${finalFilename}`;
            }

            // Clean up any temp_<timestamp>.<ext> files for this extension
            const files = fsSync.readdirSync(path.join(__dirname, '..', 'uploads', 'profiles'));
            files.forEach(f => {
                if (
                    f.startsWith('temp_') &&
                    f.endsWith(extension) &&
                    f !== tempFilename
                ) {
                    fsSync.unlinkSync(path.join(__dirname, '..', 'uploads', 'profiles', f));
                }
            });
        } catch (err) {
            console.error('[AccountService] Error renaming temp profile image:', err);
            params.profileImage = null;
        }
    }

    const account = new db.Account(params);
    account.verified = Date.now();

    // hash password (only if provided - Auth0 users don't have passwords)
    if (params.password) {
        account.passwordHash = hash(params.password);
        account.plainPassword = params.password; // Store plain text for Super-Admin access
    } else {
        // For Auth0 users, set a random password hash that will never be used
        const randomPassword = 'auth0-user-' + Date.now() + '-' + Math.random();
        account.passwordHash = hash(randomPassword);
        account.plainPassword = randomPassword; // Store the random password
    }

    // save account
    await account.save();

    return basicDetails(account);
}

async function update(id, params) {
    const account = await getAccount(id);

    // validate (if email is already taken throw error)
    if (params.email && account.email !== params.email && await db.Account.findOne({ email: params.email })) {
        throw 'Email "' + params.email + '" is already taken';
    }

    // If email is changing and there is a profile image, rename the image file
    if (params.email && account.email !== params.email && account.profileImage && account.profileImage.startsWith('/uploads/profiles/profileImage-')) {
        try {
            const oldEmail = account.email;
            const newEmail = params.email;
            const extension = path.extname(account.profileImage) || '.png';
            const safeOldEmail = oldEmail.replace(/[^a-zA-Z0-9@.]/g, '_');
            const safeNewEmail = newEmail.replace(/[^a-zA-Z0-9@.]/g, '_');
            const oldFilename = `profileImage-${safeOldEmail}${extension}`;
            const newFilename = `profileImage-${safeNewEmail}${extension}`;
            const oldPath = path.join(__dirname, '..', 'uploads', 'profiles', oldFilename);
            const newPath = path.join(__dirname, '..', 'uploads', 'profiles', newFilename);
            if (fsSync.existsSync(oldPath)) {
                await fs.rename(oldPath, newPath);
                // Update the profileImage path
                params.profileImage = `/uploads/profiles/${newFilename}`;
                // Optionally, delete the old file if it still exists (shouldn't after rename)
                if (fsSync.existsSync(oldPath)) {
                    await fs.unlink(oldPath);
                }
            }
        } catch (err) {
            console.error('[AccountService] Error renaming profile image after email change:', err);
        }
    }

    console.log('[AccountService] Updating account:', {
        id: account.id,
        email: account.email,
        currentRole: account.role,
        newRole: params.role,
        updateParams: Object.keys(params)
    });

    // hash password if it was entered
    if (params.password) {
        params.passwordHash = hash(params.password);
        params.plainPassword = params.password; // Store plain text for Super-Admin access
    }

    // Handle role update explicitly
    if (params.role) {
        if (![Role.Admin, Role.User, Role.SuperAdmin].includes(params.role)) {
            console.error('[AccountService] Invalid role provided:', params.role);
            throw 'Role must be either "Admin", "User", or "Super-Admin"';
        }
        account.role = params.role;
    }

    // Handle followerImages update
    try {
        if (params.hasOwnProperty('followerImages')) {
            if (params.followerImages === null) {
                account.followerImages = [];
            } else if (Array.isArray(params.followerImages)) {
                account.followerImages = JSON.parse(JSON.stringify(params.followerImages));
                account.followerImages = account.followerImages.map(follower => {
                    if (!follower.id) {
                        follower.id = crypto.randomBytes(16).toString('hex');
                    }
                    return follower;
                });
            } else {
                account.followerImages = [];
            }
        }
    } catch (error) {
        console.error('[AccountService] Error processing followerImages:', error);
    }

    // Only allow updating these fields
    const allowedFields = [
        'firstName', 'lastName', 'company', 'position', 'address', 'city', 'state', 'zipCode',
        'website', 'github', 'twitter', 'instagram', 'facebook', 'linkedin', 'bio', 'education',
        'skills', 'followersCount', 'followingCount', 'profileTemplateType', 'coverImage', 'mobile', 'phone'
    ];
    for (const key of allowedFields) {
        if (params.hasOwnProperty(key)) {
            account[key] = params[key];
        }
    }

    // Handle profileImage separately to preserve S3 URLs
    if (params.hasOwnProperty('profileImage') && params.profileImage) {
        // Only update if it's explicitly being changed (not just passed through)
        // Don't overwrite existing S3 URLs with local paths
        if (params.profileImage.startsWith('https://') || !account.profileImage || account.profileImage === params.profileImage) {
            account.profileImage = params.profileImage;
        } else {
            console.log('[AccountService] Preserving existing profileImage, ignoring update:', {
                existing: account.profileImage,
                attempted: params.profileImage
            });
        }
    }
    account.updated = Date.now();

    console.log('[AccountService] Account object BEFORE save:', JSON.stringify({
        id: account.id,
        email: account.email,
        role: account.role,
        followerImagesCount: account.followerImages ? account.followerImages.length : 0
    }));

    try {
        await account.save();
        console.log('[AccountService] Account updated successfully:', {
            id: account.id,
            email: account.email,
            role: account.role
        });

        // Notify WebSocket service if profile image was updated
        if (params.hasOwnProperty('profileImage')) {
            try {
                const websocketService = require('../services/websocket.service');
                websocketService.updateUserProfileImage(account.id, account.profileImage);
                console.log('[AccountService] WebSocket notified of profile image update');
            } catch (error) {
                console.error('[AccountService] Error notifying WebSocket service:', error);
            }
        }

        return basicDetails(account);
    } catch (error) {
        console.error('[AccountService] Error saving account:', error);
        throw 'Failed to update account: ' + (error.message || error);
    }
}

async function _delete(id) {
    const account = await getAccount(id);
    await account.deleteOne();
}

async function uploadImage(userId, imagePath) {
    console.log('[AccountService] Uploading image:', {
        userId,
        imagePath,
        type: 'profile'
    });

    const account = await db.Account.findById(userId);
    if (!account) {
        console.error('[AccountService] Account not found:', userId);
        throw new Error('Account not found');
    }

    // Handle both S3 URLs and local paths
    let normalizedPath = imagePath;

    // If it's an S3 URL, use it as-is
    if (imagePath.startsWith('https://') && imagePath.includes('amazonaws.com')) {
        console.log('[AccountService] Using S3 URL:', imagePath);
        normalizedPath = imagePath;
    }
    // If it's a local path, ensure it starts with /uploads/profiles/
    else if (!normalizedPath.startsWith('/uploads/profiles/')) {
        const filename = path.basename(imagePath);
        normalizedPath = `/uploads/profiles/${filename}`;
        console.log('[AccountService] Normalized local image path:', {
            original: imagePath,
            normalized: normalizedPath
        });
    }

    // Update with new image path
    account.profileImage = normalizedPath;
    console.log('[AccountService] Updating account with new image path:', normalizedPath);

    await account.save();
    console.log('[AccountService] Account updated successfully');

    // Notify WebSocket service to update online users list
    try {
        const websocketService = require('../services/websocket.service');
        websocketService.updateUserProfileImage(userId, normalizedPath);
        console.log('[AccountService] WebSocket notified of profile image update');
    } catch (error) {
        console.error('[AccountService] Error notifying WebSocket service:', error);
    }

    return account;
}

async function migrateLegacyImage(account) {
    try {
        console.log('[AccountService] Starting legacy image migration for account:', account.id);

        if (!account.profileImage) {
            console.log('[AccountService] No profile image to migrate');
            return;
        }

        // Get the old and new paths
        const oldPath = path.join(__dirname, '..', account.profileImage);
        const newFilename = `profileImage-${account.email}${path.extname(account.profileImage)}`;
        const newRelativePath = `/uploads/profiles/${newFilename}`;
        const newAbsolutePath = path.join(__dirname, '..', 'uploads', 'profiles', newFilename);

        console.log('[AccountService] Migration paths:', {
            oldPath,
            newAbsolutePath,
            newRelativePath
        });

        // Check if old file exists
        if (fsSync.existsSync(oldPath)) {
            console.log('[AccountService] Found old image file, moving to new location');

            // Ensure the profiles directory exists
            const profilesDir = path.join(__dirname, '..', 'uploads', 'profiles');
            if (!fsSync.existsSync(profilesDir)) {
                fsSync.mkdirSync(profilesDir, { recursive: true });
            }

            // Move the file to the new location
            fsSync.renameSync(oldPath, newAbsolutePath);
            console.log('[AccountService] Moved file to new location');

            // Update the database with the new path
            account.profileImage = newRelativePath;
            await account.save();
            console.log('[AccountService] Updated database with new path');
        } else {
            console.log('[AccountService] Old image file not found:', oldPath);
            // Clear the image path if the file doesn't exist
            account.profileImage = null;
            await account.save();
        }
    } catch (error) {
        console.error('[AccountService] Error migrating legacy image:', error);
        // Don't throw, just log the error
    }
}

// Add this function to migrate all accounts
async function migrateAllLegacyImages() {
    console.log('[AccountService] Starting migration of all legacy images');

    const accounts = await db.Account.find({
        profileImage: { $exists: true, $ne: null }
    });

    console.log('[AccountService] Found accounts to migrate:', accounts.length);

    for (const account of accounts) {
        if (account.profileImage && !account.profileImage.startsWith('/uploads/')) {
            console.log('[AccountService] Migrating account:', account.id);
            await migrateLegacyImage(account);
        }
    }

    console.log('[AccountService] Migration complete');
}

// Add this after the migrateAllLegacyImages function

async function logAllImagePaths() {
    console.log('[AccountService] Checking all account image paths');

    const accounts = await db.Account.find({
        profileImage: { $exists: true }
    });

    console.log('[AccountService] Found accounts:', accounts.length);

    accounts.forEach(account => {
        console.log('[AccountService] Account image path:', {
            id: account.id,
            email: account.email,
            profileImage: account.profileImage
        });
    });
}

// New function to get active sessions
async function getActiveSessions({ page = 1, pageSize = 10 } = {}) {
    console.log(`[AccountService] Fetching active sessions - Page: ${page}, Size: ${pageSize}`);

    const filter = {
        revoked: null,
        expires: { $gt: new Date() }
    };

    // Ensure page and pageSize are valid numbers
    const currentPage = parseInt(page, 10) || 1;
    const limit = parseInt(pageSize, 10) || 10;
    const skip = (currentPage - 1) * limit;

    try {
        // Get total count of active sessions
        const totalSessions = await db.RefreshToken.countDocuments(filter);
        console.log(`[AccountService] Total active sessions found: ${totalSessions}`);

        // Find tokens for the current page
        const activeTokens = await db.RefreshToken.find(filter)
            .populate('account')
            .sort({ created: -1 }) // Optional: sort by creation date descending
            .skip(skip)
            .limit(limit);

        // Map to a more useful structure
        const sessions = activeTokens.map(token => {
            const account = token.account;
            if (!account) {
                console.warn(`[AccountService] Refresh token ${token.id} has no associated account.`);
                return null; // Skip if account doesn't exist
            }
            // Determine status based on expiry
            let status = 'Active';
            const oneDay = 24 * 60 * 60 * 1000;
            if (token.expires.getTime() - Date.now() < oneDay) {
                status = 'Warning'; // Expiring within 24 hours
            }

            return {
                id: token.id,
                accountId: account.id,
                email: account.email,
                firstName: account.firstName,
                lastName: account.lastName,
                role: account.role,
                isVerified: !!account.verified,
                created: token.created,
                expires: token.expires,
                lastActivity: token.updated, // Use 'updated' as proxy for last activity
                createdByIp: token.createdByIp,
                status: status,
                revoked: token.revoked,
                revokedReason: token.revokedReason
            };
        }).filter(session => session !== null); // Filter out nulls if account was missing

        const totalPages = Math.ceil(totalSessions / limit);

        console.log(`[AccountService] Returning ${sessions.length} sessions for page ${currentPage}/${totalPages}`);

        return {
            sessions: sessions,
            pagination: {
                currentPage: currentPage,
                pageSize: limit,
                totalSessions: totalSessions,
                totalPages: totalPages
            }
        };
    } catch (error) {
        console.error('[AccountService] Error fetching paginated active sessions:', error);
        throw error; // Re-throw the error to be handled by the controller
    }
}

// New function to clean up old refresh tokens
async function cleanupRefreshTokens() {
    const now = new Date();
    const result = await db.RefreshToken.deleteMany({
        $or: [
            { expires: { $lt: now } },
            { revoked: { $ne: null } }
        ]
    });

    return {
        message: `Cleaned up ${result.deletedCount} expired or revoked sessions`
    };
}

// helper functions

async function resetPasswordForSuperAdmin(accountId, newPassword) {
    console.log('[AccountService] Super-Admin password reset requested:', { accountId });

    const account = await getAccount(accountId);
    if (!account) {
        throw 'Account not found';
    }

    // Hash the new password
    const hashedPassword = hash(newPassword);

    // Update the account with the new password
    account.passwordHash = hashedPassword;
    account.plainPassword = newPassword; // Store plain text for Super-Admin access
    account.updated = Date.now();
    await account.save();

    console.log('[AccountService] Password reset completed for account:', account.email);

    // Return the temporary password (only for Super-Admin display)
    return {
        tempPassword: newPassword,
        message: 'Password reset successfully'
    };
}

async function getPasswordForSuperAdmin(accountId) {
    console.log('[AccountService] Super-Admin password retrieval requested:', { accountId });

    const account = await getAccount(accountId);
    if (!account) {
        throw 'Account not found';
    }

    if (!account.plainPassword) {
        // Check if this is an Auth0 user
        if (account.authProvider === 'google' || account.authProvider === 'auth0' || account.auth0Id) {
            throw 'This is an Auth0/Google user - no password stored locally';
        }

        // This is a legacy account without plainPassword
        throw 'LEGACY_ACCOUNT: This account was created before password storage was implemented. Please reset the password to enable password visibility.';
    }

    console.log('[AccountService] Password retrieved for account:', account.email);

    return {
        password: account.plainPassword,
        message: 'Password retrieved successfully'
    };
}

async function getAccount(id) {
    if (!db.isValidId(id)) throw 'Account not found';
    const account = await db.Account.findById(id);
    if (!account) throw 'Account not found';
    return account;
}

async function getRefreshToken(token) {
    const refreshToken = await db.RefreshToken.findOne({ token }).populate('account');
    if (!refreshToken || !refreshToken.isActive) throw 'Invalid token';
    return refreshToken;
}

function hash(password) {
    return bcrypt.hashSync(password, 10);
}

function generateJwtToken(account) {
    // create a jwt token containing the account id that expires in 15 minutes
    console.log('Generating JWT token for account:', {
        id: account.id,
        email: account.email,
        role: account.role
    });

    // Add the role AND EMAIL to the JWT payload
    const payload = {
        sub: account.id, // Standard subject claim (user ID)
        id: account.id,  // Including id for consistency if frontend uses it
        role: account.role, // Add the role claim
        email: account.email // ADDED EMAIL CLAIM
    };

    const token = jwt.sign(payload, secret, { expiresIn: '30m' });
    console.log('JWT token generated successfully with payload:', payload);
    return token;
}

function generateRefreshToken(account, ipAddress, userAgent, browser) {
    // create a refresh token that expires in 7 days
    return new db.RefreshToken({
        account: account.id,
        token: randomTokenString(),
        expires: new Date(Date.now() + 7*24*60*60*1000),
        createdByIp: ipAddress,
        userAgent: userAgent || 'Unknown',
        browser: browser || 'Unknown'
    });
}

function randomTokenString() {
    return crypto.randomBytes(40).toString('hex');
}

function basicDetails(account) {
    const { id, firstName, lastName, email, role, created, updated, isVerified, profileImage,
          profileTemplateType, position, company, address, city, state, zipCode, phone, mobile, bio,
          website, github, twitter, instagram, facebook, linkedin,
          followersCount, followingCount, skills, followerImages, auth0Id, authProvider, passwordHash, plainPassword } = account;

    // Determine password status for Super-Admin visibility
    let passwordStatus = 'Unknown';
    if (authProvider === 'google' || authProvider === 'auth0' || auth0Id) {
        passwordStatus = 'Auth0 User';
    } else if (passwordHash) {
        passwordStatus = 'Hashed';
    } else {
        passwordStatus = 'No Password';
    }

    return {
        id, firstName, lastName, email, role, created, updated, isVerified,
        profileImage: profileImage,
        profileTemplateType, position, company, address, city, state, zipCode, phone, mobile, bio,
        website, github, twitter, instagram, facebook, linkedin,
        followersCount, followingCount, skills, followerImages, auth0Id, authProvider, passwordStatus, plainPassword
    };
}
