/**
 * Writes server/secrets/config.json from environment variables.
 * Use on Render (or any host) so you don't commit secrets.
 * Run before starting the server: node scripts/write-config-from-env.js && node server.js
 */
const fs = require('fs');
const path = require('path');

const secretsDir = path.join(__dirname, '..', 'secrets');
const configPath = path.join(secretsDir, 'config.json');

function isPlaceholderMongoUri(uri) {
  if (!uri) return true;
  return /example\.(net|com)|@cluster0\.example\.|\/test$/i.test(uri) || uri.includes('test:test@');
}

// Local dev uses server/secrets/config.json — only rewrite on Render (or when explicitly forced)
if (!process.env.RENDER && process.env.FORCE_WRITE_CONFIG !== '1') {
  console.log('[write-config-from-env] Skipping — not on Render (keeping server/secrets/config.json)');
  process.exit(0);
}

const mongoUri = typeof process.env.MONGODB_URI === 'string' ? process.env.MONGODB_URI.trim() : '';

if (!mongoUri) {
  console.log('[write-config-from-env] MONGODB_URI not set, skipping (using existing config.json if present)');
  process.exit(0);
}

if (!/^mongodb(\+srv)?:\/\//i.test(mongoUri)) {
  console.error('[write-config-from-env] MONGODB_URI must start with mongodb:// or mongodb+srv://');
  console.error('[write-config-from-env] Got (first 60 chars):', mongoUri.substring(0, 60));
  process.exit(1);
}

if (isPlaceholderMongoUri(mongoUri)) {
  console.error('[write-config-from-env] Refusing to write placeholder/test MONGODB_URI to config.json');
  process.exit(1);
}

if (!fs.existsSync(secretsDir)) {
  fs.mkdirSync(secretsDir, { recursive: true });
}

const config = {
  connectionString: mongoUri,
  DBName: process.env.DB_NAME || 'profiling-app',
  secret: process.env.JWT_SECRET || process.env.SECRET || 'change-me-in-production',
  googleApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  s3Region: process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1',
  s3BucketName: process.env.S3_BUCKET_NAME || ''
};

fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
console.log('[write-config-from-env] Wrote config.json from environment variables');
process.exit(0);
