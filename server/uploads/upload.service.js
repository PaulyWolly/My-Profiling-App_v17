const fs = require('fs').promises;
const path = require('path');
const db = require('../_helpers/db');
const Account = db.Account;
const mongoose = require('mongoose');

// Add utility functions for common operations
async function ensureDirectoryExists(dir) {
    if (!fsSync.existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
        console.log(`[UploadService] Created directory: ${dir}`);
    }
}

async function safeDeleteFile(filePath) {
    try {
        if (fsSync.existsSync(filePath)) {
            await fs.unlink(filePath);
            console.log(`[UploadService] Successfully deleted file: ${filePath}`);
            return true;
        }
        console.log(`[UploadService] File does not exist: ${filePath}`);
        return false;
    } catch (error) {
        console.error(`[UploadService] Error deleting file:`, error);
        return false;
    }
}

async function getProfileImage(userId) {
    console.log(`[UploadService] Getting profile image for user: ${userId}`);
    const account = await Account.findById(userId);
    
    if (!account || !account.profileImage) {
        console.log(`[UploadService] No profile image found for user: ${userId}`);
        return null;
    }

    return account.profileImage;
}

async function updateProfileImage(userId, filename) {
    console.log(`[UploadService] Updating profile image for user: ${userId} with filename: ${filename}`);
    
    const account = await Account.findById(userId);
    if (!account) {
        throw new Error('User not found');
    }

    // Update the profile image path in the database
    account.profileImage = filename;
    await account.save();

    console.log(`[UploadService] Profile image updated successfully for user: ${userId}`);
    return { message: 'Profile image updated successfully' };
}

async function deleteProfileImage(userId) {
    console.log(`[UploadService] Deleting profile image for user: ${userId}`);
    
    const account = await Account.findById(userId);
    if (!account || !account.profileImage) {
        console.log(`[UploadService] No profile image to delete for user: ${userId}`);
        return;
    }

    // Clear the image reference in the database
    account.profileImage = null;
    await account.save();

    console.log(`[UploadService] Profile image reference deleted for user: ${userId}`);
}

async function getFollowerImage(userId) {
    console.log(`[UploadService] Getting follower image for user: ${userId}`);
    const account = await Account.findById(userId);
    
    if (!account || !account.followerImage) {
        console.log(`[UploadService] No follower image found for user: ${userId}`);
        return null;
    }

    return account.followerImage;
}

async function updateFollowerImage(userId, filename) {
    console.log(`[UploadService] Updating follower image for user: ${userId} with filename: ${filename}`);
    
    const account = await Account.findById(userId);
    if (!account) {
        throw new Error('User not found');
    }

    // Update the follower image path in the database
    account.followerImage = filename;
    await account.save();

    console.log(`[UploadService] Follower image updated successfully for user: ${userId}`);
    return { message: 'Follower image updated successfully' };
}

async function deleteFollowerImage(userId) {
    console.log(`[UploadService] Deleting follower image for user: ${userId}`);
    
    const account = await Account.findById(userId);
    if (!account || !account.followerImage) {
        console.log(`[UploadService] No follower image to delete for user: ${userId}`);
        return;
    }

    // Clear the image reference in the database
    account.followerImage = null;
    await account.save();

    console.log(`[UploadService] Follower image reference deleted for user: ${userId}`);
}

// Export all functions AFTER they are defined
module.exports = {
    getProfileImage,
    updateProfileImage,
    deleteProfileImage,
    getFollowerImage,
    updateFollowerImage,
    deleteFollowerImage
}; 