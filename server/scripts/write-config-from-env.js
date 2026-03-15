/**
 * Writes server/secrets/config.json from environment variables.
 * Use on Render (or any host) so you don't commit secrets.
 * Run before starting the server: node scripts/write-config-from-env.js && node server.js
 */
const fs = require('fs');
const path = require('path');

const secretsDir = path.join(__dirname, '..', 'secrets');
const configPath = path.join(secretsDir, 'config.json');

if (!process.env.MONGODB_URI) {
  console.log('[write-config-from-env] MONGODB_URI not set, skipping (using existing config.json if present)');
  process.exit(0);
}

if (!fs.existsSync(secretsDir)) {
  fs.mkdirSync(secretsDir, { recursive: true });
}

const config = {
  connectionString: process.env.MONGODB_URI,
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
