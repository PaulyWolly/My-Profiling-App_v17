const fs = require('fs');
const path = require('path');

const DEFAULT_AVATAR = '/assets/images/default-avatar.svg';

let config = {};
try {
    config = require('../secrets/config.json');
} catch (e) {
    config = {};
}

function getApiBaseUrl() {
    return (process.env.API_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
}

function getS3Bucket() {
    return config.s3BucketName || process.env.S3_BUCKET_NAME || '';
}

function getS3Region() {
    return config.s3Region || process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1';
}

function extractUploadsPath(storedPath) {
    if (!storedPath) return null;

    let value = storedPath.trim();
    if (!value) return null;

    if (value.startsWith('http://') || value.startsWith('https://')) {
        try {
            value = new URL(value).pathname;
        } catch (e) {
            return null;
        }
    }

    if (value.startsWith('/assets/')) {
        return value;
    }

    if (!value.startsWith('/')) {
        value = `/${value}`;
    }

    if (value.startsWith('/uploads/')) {
        return value;
    }

    if (value.includes('/uploads/')) {
        const idx = value.indexOf('/uploads/');
        return value.slice(idx);
    }

    const fileName = path.basename(value);
    return `/uploads/profiles/${fileName}`;
}

function localUploadExists(relativePath) {
    if (!relativePath || !relativePath.startsWith('/uploads/')) {
        return false;
    }

    const withoutPrefix = relativePath.replace(/^\/uploads\//, '');
    const fullPath = path.join(__dirname, '..', 'uploads', withoutPrefix);
    return fs.existsSync(fullPath);
}

function buildS3ProfileUrl(fileName) {
    const bucket = getS3Bucket();
    if (!bucket || !fileName) return null;
    return `https://${bucket}.s3.${getS3Region()}.amazonaws.com/profiles/${fileName}`;
}

function resolveProfileImageUrl(storedPath) {
    if (!storedPath) return null;

    const trimmed = storedPath.trim();
    if (!trimmed) return null;

    // Keep working external URLs (S3, Google, etc.) — rewrite localhost to current host.
    if (trimmed.startsWith('https://') && !trimmed.includes('localhost')) {
        return trimmed;
    }

    if (trimmed.startsWith('http://') && !trimmed.includes('localhost')) {
        return trimmed;
    }

    const relativePath = extractUploadsPath(trimmed);
    if (!relativePath) return null;

    if (relativePath.startsWith('/assets/')) {
        const base = getApiBaseUrl();
        return base ? `${base}${relativePath}` : relativePath;
    }

    const fileName = path.basename(relativePath);
    const apiBase = getApiBaseUrl();

    if (localUploadExists(relativePath)) {
        return apiBase ? `${apiBase}${relativePath}` : relativePath;
    }

    const s3Url = buildS3ProfileUrl(fileName);
    if (s3Url) {
        return s3Url;
    }

    if (apiBase) {
        return `${apiBase}${relativePath}`;
    }

    return DEFAULT_AVATAR;
}

function resolveFollowerImageUrl(storedPath) {
    if (!storedPath) return null;

    const trimmed = storedPath.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('https://') && !trimmed.includes('localhost')) {
        return trimmed;
    }

    let relativePath = trimmed;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        try {
            relativePath = new URL(trimmed).pathname;
        } catch (e) {
            return null;
        }
    }

    if (!relativePath.startsWith('/')) {
        relativePath = `/${relativePath}`;
    }

    if (!relativePath.startsWith('/uploads/followers/')) {
        relativePath = `/uploads/followers/${path.basename(relativePath)}`;
    }

    const apiBase = getApiBaseUrl();
    const withoutPrefix = relativePath.replace(/^\/uploads\//, '');
    const fullLocalPath = path.join(__dirname, '..', 'uploads', withoutPrefix);

    if (fs.existsSync(fullLocalPath)) {
        return apiBase ? `${apiBase}${relativePath}` : relativePath;
    }

    const bucket = getS3Bucket();
    if (bucket) {
        const fileName = path.basename(relativePath);
        return `https://${bucket}.s3.${getS3Region()}.amazonaws.com/followers/${fileName}`;
    }

    return apiBase ? `${apiBase}${relativePath}` : relativePath;
}

module.exports = {
    DEFAULT_AVATAR,
    resolveProfileImageUrl,
    resolveFollowerImageUrl
};
