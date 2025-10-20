const fs = require('fs');
const path = require('path');
const s3Service = require('./s3.service');
const config = require('../secrets/config.json');

class HybridStorageService {
    constructor() {
        this.localProfilesDir = path.join(__dirname, '..', 'uploads', 'profiles');
        this.localFollowersDir = path.join(__dirname, '..', 'uploads', 'followers');
        this.localCompanyLogosDir = path.join(__dirname, '..', 'uploads', 'company-logos');

        // Ensure local directories exist
        this.ensureDirectoriesExist();
    }

    ensureDirectoriesExist() {
        [this.localProfilesDir, this.localFollowersDir, this.localCompanyLogosDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    /**
     * Upload file to both S3 and local storage
     * @param {Buffer} fileBuffer - The file buffer
     * @param {string} fileName - The file name
     * @param {string} contentType - The MIME type
     * @param {string} folder - The folder type ('profiles', 'followers', 'company-logos')
     * @returns {Promise<{s3Url: string, localPath: string}>} - Both URLs
     */
    async uploadFile(fileBuffer, fileName, contentType, folder = 'profiles') {
        try {
            console.log('[HybridStorage] Uploading file to both S3 and local storage:', {
                fileName,
                contentType,
                folder,
                size: fileBuffer.length
            });

            // Upload to S3
            const s3Url = await s3Service.uploadFile(fileBuffer, fileName, contentType, folder);

            // Save to local storage
            const localPath = await this.saveToLocal(fileBuffer, fileName, folder);

            console.log('[HybridStorage] Upload successful:', {
                s3Url,
                localPath
            });

            return {
                s3Url,
                localPath,
                primaryUrl: s3Url, // S3 is primary
                fallbackUrl: localPath // Local is fallback
            };

        } catch (error) {
            console.error('[HybridStorage] Upload error:', error);
            throw new Error(`Failed to upload file: ${error.message}`);
        }
    }

    /**
     * Save file to local storage
     * @param {Buffer} fileBuffer - The file buffer
     * @param {string} fileName - The file name
     * @param {string} folder - The folder type
     * @returns {Promise<string>} - The local file path
     */
    async saveToLocal(fileBuffer, fileName, folder) {
        return new Promise((resolve, reject) => {
            try {
                let localDir;
                switch (folder) {
                    case 'profiles':
                        localDir = this.localProfilesDir;
                        break;
                    case 'followers':
                        localDir = this.localFollowersDir;
                        break;
                    case 'company-logos':
                        localDir = this.localCompanyLogosDir;
                        break;
                    default:
                        localDir = this.localProfilesDir;
                }

                const localPath = path.join(localDir, fileName);
                fs.writeFileSync(localPath, fileBuffer);

                // Return the URL path (not the full file system path)
                const urlPath = `/uploads/${folder}/${fileName}`;
                resolve(urlPath);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Get the best available URL for an image
     * @param {string} s3Url - The S3 URL
     * @param {string} localPath - The local path
     * @returns {string} - The best available URL
     */
    getBestUrl(s3Url, localPath) {
        // Prefer S3 URL if available, fallback to local
        return s3Url || localPath;
    }

    /**
     * Delete file from both S3 and local storage
     * @param {string} s3Url - The S3 URL
     * @param {string} localPath - The local path
     * @returns {Promise<boolean>} - True if successful
     */
    async deleteFile(s3Url, localPath) {
        try {
            const results = { s3: false, local: false };

            // Delete from S3
            if (s3Url) {
                try {
                    await s3Service.deleteFile(s3Url);
                    results.s3 = true;
                    console.log('[HybridStorage] S3 delete successful');
                } catch (error) {
                    console.error('[HybridStorage] S3 delete failed:', error);
                }
            }

            // Delete from local storage
            if (localPath) {
                try {
                    const fileName = path.basename(localPath);
                    const folder = localPath.includes('/followers/') ? 'followers' :
                                 localPath.includes('/company-logos/') ? 'company-logos' : 'profiles';
                    const fullPath = path.join(__dirname, '..', 'uploads', folder, fileName);

                    if (fs.existsSync(fullPath)) {
                        fs.unlinkSync(fullPath);
                        results.local = true;
                        console.log('[HybridStorage] Local delete successful');
                    }
                } catch (error) {
                    console.error('[HybridStorage] Local delete failed:', error);
                }
            }

            return results.s3 || results.local; // Success if at least one deletion worked
        } catch (error) {
            console.error('[HybridStorage] Delete error:', error);
            throw new Error(`Failed to delete file: ${error.message}`);
        }
    }

    /**
     * Sync a file from S3 to local storage
     * @param {string} s3Url - The S3 URL
     * @param {string} fileName - The file name
     * @param {string} folder - The folder type
     * @returns {Promise<string>} - The local path
     */
    async syncFromS3ToLocal(s3Url, fileName, folder = 'profiles') {
        try {
            // This would require downloading from S3 and saving locally
            // For now, we'll just return the S3 URL
            console.log('[HybridStorage] Sync from S3 to local:', { s3Url, fileName, folder });
            return s3Url;
        } catch (error) {
            console.error('[HybridStorage] Sync error:', error);
            throw error;
        }
    }

    /**
     * Check if local file exists
     * @param {string} localPath - The local path
     * @returns {boolean} - True if exists
     */
    localFileExists(localPath) {
        try {
            const fileName = path.basename(localPath);
            const folder = localPath.includes('/followers/') ? 'followers' :
                         localPath.includes('/company-logos/') ? 'company-logos' : 'profiles';
            const fullPath = path.join(__dirname, '..', 'uploads', folder, fileName);
            return fs.existsSync(fullPath);
        } catch (error) {
            return false;
        }
    }
}

module.exports = new HybridStorageService();
