const express = require('express');
const router = express.Router();
const { uploadMiddleware, uploadFollowerImage, uploadTempProfileImage } = require('./upload.controller');
const authorize = require('../_middleware/authenticate');
const busboy = require('busboy');

// Follower image upload route
router.post('/follower-image', 
    authorize(),
    uploadMiddleware,
    uploadFollowerImage
);

// Temp profile image upload route (no auth, for new accounts)
router.post('/temp-profile-image', uploadMiddleware, uploadTempProfileImage);

module.exports = router;