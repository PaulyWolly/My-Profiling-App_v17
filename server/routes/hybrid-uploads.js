const express = require('express');
const router = express.Router();
const authenticate = require('../_middleware/authenticate');
const {
    upload,
    uploadGallery,
    uploadProfileImage,
    uploadFollowerImage,
    uploadCompanyLogo,
    uploadGalleryMedia,
    deleteImage
} = require('../uploads/hybrid-upload.controller');

// Upload profile image to both S3 and local storage (auth required)
router.post('/profile-image', authenticate(), upload.single('profileImage'), uploadProfileImage);

// Upload follower image to both S3 and local storage (auth required)
router.post('/follower-image', authenticate(), upload.single('followerImage'), uploadFollowerImage);

// Upload company logo to both S3 and local storage (auth required)
router.post('/company-logo', authenticate(), upload.single('companyLogo'), uploadCompanyLogo);

// Upload gallery media (image or video, up to 1GB) (auth required)
router.post('/gallery-media', authenticate(), (req, res, next) => {
    uploadGallery.single('file')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ message: 'File too large. Maximum size is 1 GB.' });
            }
            return res.status(400).json({ message: err.message || 'Upload failed.' });
        }
        next();
    });
}, uploadGalleryMedia);

// Delete image from both S3 and local storage (auth required)
router.delete('/image', authenticate(), deleteImage);

module.exports = router;
