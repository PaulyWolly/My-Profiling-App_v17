const express = require('express');
const router = express.Router();
const {
    upload,
    uploadProfileImage,
    uploadFollowerImage,
    uploadCompanyLogo,
    deleteImage
} = require('../uploads/hybrid-upload.controller');

// Upload profile image to both S3 and local storage
router.post('/profile-image', upload.single('profileImage'), uploadProfileImage);

// Upload follower image to both S3 and local storage
router.post('/follower-image', upload.single('followerImage'), uploadFollowerImage);

// Upload company logo to both S3 and local storage
router.post('/company-logo', upload.single('companyLogo'), uploadCompanyLogo);

// Delete image from both S3 and local storage
router.delete('/image', deleteImage);

module.exports = router;
