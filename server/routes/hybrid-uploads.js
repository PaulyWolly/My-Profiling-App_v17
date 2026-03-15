const express = require('express');
const router = express.Router();
const authenticate = require('../_middleware/authenticate');
const {
    upload,
    uploadProfileImage,
    uploadFollowerImage,
    uploadCompanyLogo,
    deleteImage
} = require('../uploads/hybrid-upload.controller');

// Upload profile image to both S3 and local storage (auth required)
router.post('/profile-image', authenticate(), upload.single('profileImage'), uploadProfileImage);

// Upload follower image to both S3 and local storage (auth required)
router.post('/follower-image', authenticate(), upload.single('followerImage'), uploadFollowerImage);

// Upload company logo to both S3 and local storage (auth required)
router.post('/company-logo', authenticate(), upload.single('companyLogo'), uploadCompanyLogo);

// Delete image from both S3 and local storage (auth required)
router.delete('/image', authenticate(), deleteImage);

module.exports = router;
