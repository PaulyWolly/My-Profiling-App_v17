const { S3Client, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const config = require('../secrets/config.json');

const s3 = new S3Client({
    region: config.s3Region,
    credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey
    }
});

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

            console.log('[S3Service] Uploading file:', {
                bucket: this.bucketName,
                key: key,
                contentType: contentType,
                size: fileBuffer.length
            });

            // Upload (rather than PutObjectCommand) because it reports a Location
            // for the caller and splits large files into a multipart upload, which
            // is what the previous SDK's s3.upload() did.
            const upload = new Upload({
                client: s3,
                params: {
                    Bucket: this.bucketName,
                    Key: key,
                    Body: fileBuffer,
                    ContentType: contentType,
                    ACL: 'public-read' // Make the file publicly readable
                }
            });

            const result = await upload.done();
            const location = result.Location || this.getPublicUrl(key);

            console.log('[S3Service] Upload successful:', {
                location: location,
                key: key
            });

            return location; // Returns the public URL
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

            console.log('[S3Service] Deleting file:', {
                bucket: this.bucketName,
                key: key
            });

            await s3.send(new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key
            }));

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
            await s3.send(new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: key
            }));
            return true;
        } catch (error) {
            // A missing object surfaces as NotFound here; the status lives on
            // $metadata rather than on the error itself as it used to.
            if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
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
