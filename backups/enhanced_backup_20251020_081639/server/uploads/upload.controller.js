const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Get the absolute path to the uploads directories
const uploadsDir = path.join(__dirname, '..', 'uploads');
const profilesDir = path.join(__dirname, '..', 'uploads', 'profiles');
const followersDir = path.join(__dirname, '..', 'uploads', 'followers');

// Configure multer for file upload with dynamic destination
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Use different directories based on the endpoint
        const uploadPath = req.originalUrl.includes('follower-image') ? followersDir : profilesDir;
        
        // Ensure directory exists
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Always use a generic temp name for all uploads
        const extension = path.extname(file.originalname);
        const tempName = 'temp_upload_' + Date.now() + '_' + Math.round(Math.random() * 1E9) + extension;
        cb(null, tempName);
    }
});

// Configure multer upload
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        // Accept only images
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

// Create middleware for file upload
const uploadMiddleware = upload.single('file');

// Add a function to handle follower image uploads
async function uploadFollowerImage(req, res, next) {
    try {
        if (!req.file) {
            throw new Error('No file uploaded');
        }

        if (!req.user || !req.user.id) {
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            throw new Error('Unauthorized');
        }

        // Get follower details from the request body
        const followerName = req.body.followerName;
        const followerTitle = req.body.followerTitle;

        if (!followerName) {
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            throw new Error('Follower name is required');
        }

        // Create the final filename using follower name
        const sanitizedName = followerName.replace(/[^a-zA-Z0-9]/g, '_');
        const finalFilename = `followerImage-${sanitizedName}${path.extname(req.file.originalname)}`;
        const finalPath = path.join(followersDir, finalFilename);

        // Overwrite any existing file
        if (fs.existsSync(finalPath)) {
            fs.unlinkSync(finalPath);
        }

        // Move the uploaded file to the final location
        fs.renameSync(req.file.path, finalPath);

        const urlPath = `/uploads/followers/${finalFilename}`;
        const apiUrl = process.env.API_URL || 'http://localhost:5001';

        const follower = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            name: followerName,
            title: followerTitle || '',
            imageUrl: `${apiUrl}${urlPath}`,
            path: urlPath
        };

        return res.json(follower);
    } catch (error) {
        // Clean up temp file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.error('[UploadController:uploadFollowerImage] Error cleaning up temp file:', cleanupError);
            }
        }
        
        next(error);
    }
}

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
        const accountService = require('../accounts/account.service');
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

// Add a handler for pre-account profile image uploads (no userId/email required)
async function uploadTempProfileImage(req, res, next) {
    try {
        console.log('[uploadTempProfileImage] req.body:', req.body);
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        let email = req.body.email;
        let extension = path.extname(req.file.originalname) || '.png';
        let finalFilename = null;
        if (email) {
            let safeEmail = email.replace(/[^a-zA-Z0-9@.]/g, '_');
            finalFilename = `tempProfileImage-${safeEmail}${extension}`;
        } else if (req.body.firstname && req.body.lastname) {
            let safeName = `${req.body.firstname}_${req.body.lastname}`.replace(/[^a-zA-Z0-9_]/g, '_');
            finalFilename = `tempProfileImage-${safeName}${extension}`;
        } else {
            // Clean up uploaded file if present
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ message: 'Email or firstname+lastname is required for temp profile image uploads' });
        }
        let finalPath = path.join(profilesDir, finalFilename);

        // If the file isn't already named as desired, rename it
        if (req.file.filename !== finalFilename) {
            fs.renameSync(req.file.path, finalPath);
        }

        // Optionally, clean up any old temp files for this user
        const files = fs.readdirSync(profilesDir);
        files.forEach(f => {
            if (
                f.startsWith('temp_') &&
                f.endsWith(extension) &&
                f !== finalFilename
            ) {
                fs.unlinkSync(path.join(profilesDir, f));
            }
        });

        const urlPath = `/uploads/profiles/${finalFilename}`;
        const apiUrl = process.env.API_URL || 'http://localhost:5001';
        return res.json({
            message: 'Temp profile image uploaded successfully',
            path: urlPath,
            url: `${apiUrl}${urlPath}`,
            filename: finalFilename
        });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch {}
        }
        next(error);
    }
}

// Export the middleware and functions
module.exports = {
    upload,
    uploadMiddleware,
    uploadFollowerImage,
    uploadProfileImage,
    uploadTempProfileImage
};