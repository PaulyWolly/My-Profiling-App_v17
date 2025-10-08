const express = require('express');
const router = express.Router();
const {
    upload,
    uploadProfileImage,
    uploadFollowerImage,
    uploadCompanyLogo,
    deleteImage
} = require('../uploads/s3-upload.controller');

// Upload profile image to S3
router.post('/profile-image', upload.single('image'), uploadProfileImage);

// Upload follower image to S3
router.post('/follower-image', upload.single('image'), uploadFollowerImage);

// Upload company logo to S3
router.post('/company-logo', upload.single('image'), uploadCompanyLogo);

// Delete image from S3
router.delete('/image', deleteImage);

module.exports = router;
