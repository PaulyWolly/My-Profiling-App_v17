const multer = require('multer');
const path = require('path');
const express = require('express');
const router = express.Router();
const fs = require('fs');
const accountService = require('./account.service');
const crypto = require('crypto');

// Get the absolute path to the uploads directories
const uploadsDir = path.join(__dirname, '..', 'uploads');
const profilesDir = path.join(__dirname, '..', 'uploads', 'profiles');
const followersDir = path.join(__dirname, '..', 'uploads', 'followers');

router.get('/followers-images', (req, res) => {
    const dir = path.join(__dirname, '..', 'uploads', 'followers');
    fs.readdir(dir, (err, files) => {
        if (err) return res.status(500).json({ error: 'Unable to scan directory' });
        // Only return image files
        const images = files.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));
        res.json(images);
    });
});

console.log('[UploadController] Initialization - Directories configured:', {
    uploadsDir,
    profilesDir,
    followersDir,
    exists: {
        uploadsDir: fs.existsSync(uploadsDir),
        profilesDir: fs.existsSync(profilesDir),
        followersDir: fs.existsSync(followersDir)
    }
});

// Configure multer for file upload with dynamic destination
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        console.log('[UploadController:storage] Processing upload request:', {
            originalUrl: req.originalUrl,
            fileType: file.mimetype,
            fileName: file.originalname,
            headers: req.headers,
            body: req.body
        });

        // Use different directories based on the endpoint
        const uploadPath = req.originalUrl.includes('upload-follower-image') ? followersDir : profilesDir;
        
        console.log('[UploadController:storage] Selected upload path:', {
            uploadPath,
            exists: fs.existsSync(uploadPath),
            isDirectory: fs.existsSync(uploadPath) ? fs.statSync(uploadPath).isDirectory() : false
        });
        
        // Ensure directory exists
        if (!fs.existsSync(uploadPath)) {
            console.log('[UploadController:storage] Creating directory:', uploadPath);
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const identifier = req.body.followerEmail || req.body.followerName;
        const filename = `followerImage-${identifier}${path.extname(file.originalname)}`;
        cb(null, filename);
    }
});

// Configure multer upload
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        console.log('[UploadController:multer] Checking file:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            headers: file.headers
        });

        // Accept only images
        if (!file.mimetype.startsWith('image/')) {
            console.error('[UploadController:multer] File rejected - not an image:', file.mimetype);
            return cb(new Error('Only image files are allowed!'), false);
        }
        console.log('[UploadController:multer] File accepted');
        cb(null, true);
    }
});

// Upload profile image
async function uploadProfileImage(req, res, next) {
    console.log('[UploadController:uploadProfileImage] Starting upload process:', {
        hasFile: !!req.file,
        fileDetails: req.file ? {
            path: req.file.path,
            filename: req.file.filename,
            mimetype: req.file.mimetype,
            size: req.file.size
        } : null,
        userId: req.user?.id,
        userEmail: req.body?.userEmail,
        body: req.body,
        headers: req.headers
    });

    try {
        if (!req.file) {
            console.error('[UploadController:uploadProfileImage] No file in request');
            return res.status(400).json({ message: 'No file uploaded' });
        }

        if (!req.user || !req.user.id) {
            console.error('[UploadController:uploadProfileImage] Authentication failed:', {
                user: req.user,
                headers: req.headers
            });
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
                console.log('[UploadController:uploadProfileImage] Cleaned up temp file after auth failure');
            }
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!req.body.userEmail) {
            console.error('[UploadController:uploadProfileImage] Missing email in request');
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
                console.log('[UploadController:uploadProfileImage] Cleaned up temp file after missing email');
            }
            return res.status(400).json({ message: 'User email is required' });
        }

        // Always use .png extension regardless of input file type
        const finalFilename = `profileImage-${req.body.userEmail}.png`;
        const finalPath = path.join(profilesDir, finalFilename);
        
        console.log('[UploadController:uploadProfileImage] File paths:', {
            tempPath: req.file.path,
            finalPath,
            finalFilename,
            tempExists: fs.existsSync(req.file.path),
            finalExists: fs.existsSync(finalPath)
        });

        // Check if the file exists and log its existence
        const fileExists = fs.existsSync(finalPath);
        if (fileExists) {
            console.log('[UploadController:uploadProfileImage] Existing file details:', {
                path: finalPath,
                stats: fs.statSync(finalPath)
            });
        }

        // If a file exists at the destination, delete it first
        if (fileExists) {
            console.log('[UploadController:uploadProfileImage] Attempting to delete existing file:', finalPath);
            try {
                fs.unlinkSync(finalPath);
                console.log('[UploadController:uploadProfileImage] Successfully deleted existing file');
            } catch (err) {
                console.error('[UploadController:uploadProfileImage] Error deleting existing file:', {
                    error: err,
                    errorMessage: err.message,
                    errorCode: err.code
                });
            }
        }

        // Move the uploaded file to the final location
        console.log('[UploadController:uploadProfileImage] Moving file:', {
            from: req.file.path,
            to: finalPath,
            sourceExists: fs.existsSync(req.file.path),
            destExists: fs.existsSync(finalPath)
        });

        fs.renameSync(req.file.path, finalPath);
        console.log('[UploadController:uploadProfileImage] File move completed');

        // Create URL-friendly path that matches the static file serving configuration
        const urlPath = `/uploads/profiles/${finalFilename}`;
        
        console.log('[UploadController:uploadProfileImage] Updating database:', {
            userId: req.body.userId || req.user.id,
            urlPath
        });

        // Update database with the consistent path format
        if (!req.body.userId) {
            console.error('[UploadController:uploadProfileImage] Missing userId in request body');
            return res.status(400).json({ message: 'User ID is required for image upload' });
        }
        const account = await accountService.uploadImage(req.body.userId, urlPath);
        console.log('[UploadController:uploadProfileImage] Database updated:', {
            account,
            urlPath
        });
        
        const response = {
            message: 'Profile image uploaded successfully',
            imagePath: urlPath,
            profileImage: urlPath
        };

        console.log('[UploadController:uploadProfileImage] Sending response:', response);
        res.json(response);
    } catch (error) {
        console.error('[UploadController:uploadProfileImage] Error in upload process:', {
            error: error,
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        // Clean up temp file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
                console.log('[UploadController:uploadProfileImage] Cleaned up temp file after error');
            } catch (cleanupError) {
                console.error('[UploadController:uploadProfileImage] Error cleaning up temp file:', cleanupError);
            }
        }
        next(error);
    }
}

// Add a function to handle follower image uploads
async function uploadFollowerImage(req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        if (!req.user || !req.user.id) {
            // Clean up temp file
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!req.body.followerName) {
            // Clean up temp file
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ message: 'Follower name is required' });
        }

        // Create a sanitized version of the follower name for the filename
        const sanitizedName = req.body.followerName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        // Create the final filename with follower name
        const finalFilename = `followerImage-${sanitizedName}${path.extname(req.file.originalname)}`;
        const finalPath = path.join(followersDir, finalFilename);

        // Rename temp file to final filename
        fs.renameSync(req.file.path, finalPath);

        // Create URL-friendly path
        const urlPath = ['uploads', 'followers', finalFilename].join('/');
        
        // Get apiUrl from config
        const apiUrl = process.env.API_URL || 'http://localhost:5001';
        
        // Create follower object
        const follower = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now(), // Fallback for older Node versions
            name: req.body.followerName,
            title: req.body.followerTitle || '',
            imageUrl: `${apiUrl}/${urlPath}`,
            path: urlPath
        };

        console.log('Follower image uploaded successfully:', follower);

        // Return the follower object
        return res.status(200).json(follower);
    } catch (error) {
        console.error('Error uploading follower image:', error);
        return res.status(500).json({ message: 'Error uploading follower image' });
    }
}

module.exports = {
    upload,
    uploadProfileImage,
    uploadFollowerImage
};