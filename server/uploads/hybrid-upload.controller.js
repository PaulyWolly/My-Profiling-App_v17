const multer = require('multer');
const path = require('path');
const hybridStorage = require('../services/hybrid-storage.service');

/** Build full URL for a local path (used when S3 is not configured). */
function buildFullUrl(req, localPath) {
    const base = process.env.API_URL || (req.protocol + '://' + (req.get('host') || 'localhost'));
    return base.replace(/\/+$/, '') + (localPath.startsWith('/') ? localPath : '/' + localPath);
}

// Configure multer for memory storage (we'll upload to both S3 and local)
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Upload profile image to both S3 and local storage
async function uploadProfileImage(req, res, next) {
    try {
        console.log('[HybridUploadController] Uploading profile image:', {
            userId: req.body.userId,
            originalName: req.file?.originalname,
            size: req.file?.size,
            mimetype: req.file?.mimetype
        });

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        if (!req.body.userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        // Generate a unique filename
        const extension = path.extname(req.file.originalname);
        const safeUserId = req.body.userId.replace(/[^a-zA-Z0-9@.]/g, '_');
        const fileName = `profileImage-${safeUserId}${extension}`;

        // Upload to both S3 and local storage
        const result = await hybridStorage.uploadFile(
            req.file.buffer,
            fileName,
            req.file.mimetype,
            'profiles'
        );

        console.log('[HybridUploadController] Profile image uploaded successfully:', {
            fileName,
            s3Url: result.s3Url,
            localPath: result.localPath
        });

        const profileImageUrl = result.s3Url || buildFullUrl(req, result.localPath);
        const accountService = require('../accounts/account.service');
        await accountService.uploadImage(req.body.userId, profileImageUrl);

        const response = {
            message: result.s3Url
                ? 'Profile image uploaded successfully to both S3 and local storage'
                : 'Profile image uploaded to local storage (S3 not configured)',
            imagePath: profileImageUrl,
            profileImage: profileImageUrl,
            localPath: result.localPath,
            hybrid: {
                s3Url: result.s3Url,
                localPath: result.localPath,
                primary: result.s3Url ? 's3' : 'local',
                fallback: 'local'
            }
        };

        console.log('[HybridUploadController] Sending response:', response);
        res.json(response);

    } catch (error) {
        console.error('[HybridUploadController] Error uploading profile image:', error);
        res.status(500).json({
            message: 'Error uploading profile image',
            error: error.message
        });
    }
}

// Upload follower image to both S3 and local storage
async function uploadFollowerImage(req, res, next) {
    try {
        console.log('[HybridUploadController] Uploading follower image:', {
            originalName: req.file?.originalname,
            size: req.file?.size,
            mimetype: req.file?.mimetype
        });

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Generate a unique filename
        const extension = path.extname(req.file.originalname);
        const safeName = req.body.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'follower';
        const fileName = `followerImage-${safeName}${extension}`;

        // Upload to both S3 and local storage
        const result = await hybridStorage.uploadFile(
            req.file.buffer,
            fileName,
            req.file.mimetype,
            'followers'
        );

        console.log('[HybridUploadController] Follower image uploaded successfully:', {
            fileName,
            s3Url: result.s3Url,
            localPath: result.localPath
        });

        const imageUrl = result.s3Url || buildFullUrl(req, result.localPath);
        const response = {
            message: result.s3Url
                ? 'Follower image uploaded successfully to both S3 and local storage'
                : 'Follower image uploaded to local storage (S3 not configured)',
            imagePath: result.s3Url || result.localPath,
            imageUrl,
            localPath: result.localPath,
            path: result.localPath,
            hybrid: {
                s3Url: result.s3Url,
                localPath: result.localPath,
                primary: result.s3Url ? 's3' : 'local',
                fallback: 'local'
            }
        };

        res.json(response);

    } catch (error) {
        console.error('[HybridUploadController] Error uploading follower image:', error);
        res.status(500).json({
            message: 'Error uploading follower image',
            error: error.message
        });
    }
}

// Upload company logo to both S3 and local storage
async function uploadCompanyLogo(req, res, next) {
    try {
        console.log('[HybridUploadController] Uploading company logo:', {
            userId: req.body.userId,
            originalName: req.file?.originalname,
            size: req.file?.size,
            mimetype: req.file?.mimetype
        });

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        if (!req.body.userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        // Generate a unique filename
        const extension = path.extname(req.file.originalname);
        const safeUserId = req.body.userId.replace(/[^a-zA-Z0-9@.]/g, '_');
        const fileName = `companyLogo-${safeUserId}${extension}`;

        // Upload to both S3 and local storage
        const result = await hybridStorage.uploadFile(
            req.file.buffer,
            fileName,
            req.file.mimetype,
            'company-logos'
        );

        console.log('[HybridUploadController] Company logo uploaded successfully:', {
            fileName,
            s3Url: result.s3Url,
            localPath: result.localPath
        });

        const response = {
            message: 'Company logo uploaded successfully to both S3 and local storage',
            imagePath: result.s3Url,
            companyLogo: result.s3Url,
            localPath: result.localPath,
            hybrid: {
                s3Url: result.s3Url,
                localPath: result.localPath,
                primary: 's3',
                fallback: 'local'
            }
        };

        res.json(response);

    } catch (error) {
        console.error('[HybridUploadController] Error uploading company logo:', error);
        res.status(500).json({
            message: 'Error uploading company logo',
            error: error.message
        });
    }
}

// Delete image from both S3 and local storage
async function deleteImage(req, res, next) {
    try {
        const { s3Url, localPath } = req.body;

        if (!s3Url && !localPath) {
            return res.status(400).json({ message: 'Either S3 URL or local path is required' });
        }

        console.log('[HybridUploadController] Deleting image:', { s3Url, localPath });

        const success = await hybridStorage.deleteFile(s3Url, localPath);

        if (success) {
            console.log('[HybridUploadController] Image deleted successfully');
            res.json({ message: 'Image deleted successfully from both S3 and local storage' });
        } else {
            res.status(500).json({ message: 'Failed to delete image' });
        }

    } catch (error) {
        console.error('[HybridUploadController] Error deleting image:', error);
        res.status(500).json({
            message: 'Error deleting image',
            error: error.message
        });
    }
}

module.exports = {
    upload,
    uploadProfileImage,
    uploadFollowerImage,
    uploadCompanyLogo,
    deleteImage
};
