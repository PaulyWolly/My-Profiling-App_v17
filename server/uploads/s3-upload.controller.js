const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const s3Service = require('../services/s3.service');

// Configure multer for memory storage (we'll upload directly to S3)
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

// Upload profile image to S3
async function uploadProfileImage(req, res, next) {
    try {
        console.log('[S3UploadController] Uploading profile image:', {
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

        // Upload to S3
        const publicUrl = await s3Service.uploadFile(
            req.file.buffer,
            fileName,
            req.file.mimetype,
            'profiles'
        );

        console.log('[S3UploadController] Profile image uploaded successfully:', {
            fileName,
            publicUrl
        });

        // Update database with the S3 URL
        const accountService = require('../accounts/account.service');
        const account = await accountService.uploadImage(req.body.userId, publicUrl);

        const response = {
            message: 'Profile image uploaded successfully',
            imagePath: publicUrl,
            profileImage: publicUrl
        };

        console.log('[S3UploadController] Sending response:', response);
        res.json(response);

    } catch (error) {
        console.error('[S3UploadController] Error uploading profile image:', error);
        res.status(500).json({
            message: 'Error uploading profile image',
            error: error.message
        });
    }
}

// Upload follower image to S3
async function uploadFollowerImage(req, res, next) {
    try {
        console.log('[S3UploadController] Uploading follower image:', {
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

        // Upload to S3
        const publicUrl = await s3Service.uploadFile(
            req.file.buffer,
            fileName,
            req.file.mimetype,
            'followers'
        );

        console.log('[S3UploadController] Follower image uploaded successfully:', {
            fileName,
            publicUrl
        });

        const response = {
            message: 'Follower image uploaded successfully',
            imagePath: publicUrl,
            imageUrl: publicUrl
        };

        res.json(response);

    } catch (error) {
        console.error('[S3UploadController] Error uploading follower image:', error);
        res.status(500).json({
            message: 'Error uploading follower image',
            error: error.message
        });
    }
}

// Upload company logo to S3
async function uploadCompanyLogo(req, res, next) {
    try {
        console.log('[S3UploadController] Uploading company logo:', {
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

        // Upload to S3
        const publicUrl = await s3Service.uploadFile(
            req.file.buffer,
            fileName,
            req.file.mimetype,
            'company-logos'
        );

        console.log('[S3UploadController] Company logo uploaded successfully:', {
            fileName,
            publicUrl
        });

        const response = {
            message: 'Company logo uploaded successfully',
            imagePath: publicUrl,
            companyLogo: publicUrl
        };

        res.json(response);

    } catch (error) {
        console.error('[S3UploadController] Error uploading company logo:', error);
        res.status(500).json({
            message: 'Error uploading company logo',
            error: error.message
        });
    }
}

// Delete image from S3
async function deleteImage(req, res, next) {
    try {
        const { imageUrl } = req.body;

        if (!imageUrl) {
            return res.status(400).json({ message: 'Image URL is required' });
        }

        console.log('[S3UploadController] Deleting image:', { imageUrl });

        await s3Service.deleteFile(imageUrl);

        console.log('[S3UploadController] Image deleted successfully');

        res.json({ message: 'Image deleted successfully' });

    } catch (error) {
        console.error('[S3UploadController] Error deleting image:', error);
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
