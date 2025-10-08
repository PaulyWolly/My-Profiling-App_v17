const AWS = require('aws-sdk');
const config = require('../secrets/config.json');

// Configure AWS SDK
AWS.config.update({
    accessKeyId: config.awsAccessKeyId,
    secretAccessKey: config.awsSecretAccessKey,
    region: config.s3Region
});

const s3 = new AWS.S3();

class S3Service {
    constructor() {
        this.bucketName = config.s3BucketName;
        this.region = config.s3Region;
    }

    /**
     * Upload a file to S3
     * @param {Buffer} fileBuffer - The file buffer
     * @param {string} fileName - The file name
     * @param {string} contentType - The MIME type
     * @param {string} folder - The folder path (e.g., 'profiles', 'company-logos')
     * @returns {Promise<string>} - The public URL of the uploaded file
     */
    async uploadFile(fileBuffer, fileName, contentType, folder = 'profiles') {
        try {
            const key = `${folder}/${fileName}`;

            const uploadParams = {
                Bucket: this.bucketName,
                Key: key,
                Body: fileBuffer,
                ContentType: contentType,
                ACL: 'public-read' // Make the file publicly readable
            };

            console.log('[S3Service] Uploading file:', {
                bucket: this.bucketName,
                key: key,
                contentType: contentType,
                size: fileBuffer.length
            });

            const result = await s3.upload(uploadParams).promise();

            console.log('[S3Service] Upload successful:', {
                location: result.Location,
                key: result.Key
            });

            return result.Location; // Returns the public URL
        } catch (error) {
            console.error('[S3Service] Upload error:', error);
            throw new Error(`Failed to upload file to S3: ${error.message}`);
        }
    }

    /**
     * Delete a file from S3
     * @param {string} fileUrl - The public URL of the file to delete
     * @returns {Promise<boolean>} - True if successful
     */
    async deleteFile(fileUrl) {
        try {
            // Extract key from URL
            const key = this.extractKeyFromUrl(fileUrl);
            if (!key) {
                throw new Error('Invalid S3 URL');
            }

            const deleteParams = {
                Bucket: this.bucketName,
                Key: key
            };

            console.log('[S3Service] Deleting file:', {
                bucket: this.bucketName,
                key: key
            });

            await s3.deleteObject(deleteParams).promise();

            console.log('[S3Service] Delete successful');
            return true;
        } catch (error) {
            console.error('[S3Service] Delete error:', error);
            throw new Error(`Failed to delete file from S3: ${error.message}`);
        }
    }

    /**
     * Extract the S3 key from a public URL
     * @param {string} url - The public S3 URL
     * @returns {string|null} - The S3 key or null if invalid
     */
    extractKeyFromUrl(url) {
        try {
            const urlObj = new URL(url);
            // Remove leading slash from pathname
            return urlObj.pathname.substring(1);
        } catch (error) {
            console.error('[S3Service] Error extracting key from URL:', error);
            return null;
        }
    }

    /**
     * Check if a file exists in S3
     * @param {string} key - The S3 key
     * @returns {Promise<boolean>} - True if file exists
     */
    async fileExists(key) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: key
            };

            await s3.headObject(params).promise();
            return true;
        } catch (error) {
            if (error.statusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Get the public URL for a given S3 key
     * @param {string} key - The S3 key
     * @returns {string} - The public URL
     */
    getPublicUrl(key) {
        return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
    }
}

module.exports = new S3Service();
