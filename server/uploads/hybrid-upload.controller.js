const multer = require('multer');
const path = require('path');
const hybridStorage = require('../services/hybrid-storage.service');
const Role = require('../_helpers/role');

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
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Gallery: allow images and videos (including .mkv, .mp4, .mpeg, etc.), 1GB limit for large videos
const GALLERY_MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1 GB
const ALLOWED_VIDEO_EXT = ['.mkv', '.webm', '.mp4', '.mov', '.avi', '.m4v', '.ogv', '.wmv', '.mpeg', '.mpg'];
function isAllowedGalleryFile(file) {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) return true;
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ALLOWED_VIDEO_EXT.includes(ext)) return true; // e.g. .mkv when browser sends application/octet-stream
    return false;
}
const uploadGallery = multer({
    storage: storage,
    limits: { fileSize: GALLERY_MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        if (isAllowedGalleryFile(file)) {
            cb(null, true);
        } else {
            cb(new Error('Only image and video files are allowed (e.g. jpg, png, gif, mp4, mkv, webm, mpeg)'), false);
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

        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const targetId = String(req.body.userId);
        const selfId = String(req.user.id);
        const isElevated = req.user.role === Role.Admin || req.user.role === Role.SuperAdmin;
        if (targetId !== selfId && !isElevated) {
            return res.status(403).json({ message: 'You can only upload a profile image for your own account' });
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

// Upload gallery media (image or video) to S3 + local
async function uploadGalleryMedia(req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        if (!req.user?.id) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const extension = path.extname(req.file.originalname);
        const safeId = (req.body.userId || req.user.id).toString().replace(/[^a-zA-Z0-9@.]/g, '_');
        const fileName = `gallery-${safeId}-${Date.now()}${extension}`;
        const isVideo = req.file.mimetype.startsWith('video/') || ALLOWED_VIDEO_EXT.includes(path.extname(req.file.originalname || '').toLowerCase());
        const folder = 'gallery';

        const result = await hybridStorage.uploadFile(
            req.file.buffer,
            fileName,
            req.file.mimetype,
            folder
        );

        const mediaUrl = result.s3Url || buildFullUrl(req, result.localPath);
        res.json({
            message: 'Gallery media uploaded',
            url: mediaUrl,
            localPath: result.localPath,
            type: isVideo ? 'video' : 'image',
            caption: req.body.caption || ''
        });
    } catch (error) {
        console.error('[HybridUploadController] Error uploading gallery media:', error);
        res.status(500).json({ message: 'Error uploading gallery media', error: error.message });
    }
}

module.exports = {
    upload,
    uploadGallery,
    uploadProfileImage,
    uploadFollowerImage,
    uploadCompanyLogo,
    uploadGalleryMedia,
    deleteImage
};
