try {
  require('dotenv').config({ path: './secrets/.env' });
} catch (e) {
  // dotenv optional on Render (secrets come from env vars + write-config-from-env.js)
}
const express = require('express');
const path = require('path');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const errorHandler = require('./_middleware/error-handler');
const fs = require('fs');
const mongoose = require('mongoose');
const http = require('http');
const websocketService = require('./services/websocket.service');
const chatApi = require('./services/chat.service.js').router;
const cookieParser = require('cookie-parser');
console.log('*** [server.js] - about to require admin-scripts.service.js ***');
const adminScriptsRouter = require('./services/admin-scripts.service');
console.log('*** [server.js] - successfully required admin-scripts.service.js ***');
require('./users/user.model');

process.stdout.write('\n'); // Ensure spinner is on its own line
const heartEmojis = ['💗','❤️','💓'];
let heartIndex = 0;
(async () => {
  const { default: ora } = await import('ora');
  const spinner = ora().start();
  setInterval(() => {
    let sessionCount = 0, userCount = 0;
    try {
      const wsService = require('./services/websocket.service');
      sessionCount = wsService.connections?.size || 0;
      userCount = wsService.userSessions?.size || 0;
    } catch (e) {}
    const now = new Date().toISOString();
    const emoji = heartEmojis[heartIndex];
    heartIndex = (heartIndex + 1) % heartEmojis.length;
    spinner.text = `${emoji}  \n---------------------------------------------------------------------\nActive sessions: ${sessionCount} | Active users: ${userCount} | Time: ${now}`;
  }, 700);
})();

// Config: use env vars on Render/production, else secrets/config.json
// If MONGODB_URI is set but invalid (e.g. placeholder "MONGODB_URI"), fall back to file so local dev still works
function loadConfig() {
  const envUri = typeof process.env.MONGODB_URI === 'string' ? process.env.MONGODB_URI.trim() : process.env.MONGODB_URI;
  const isValidMongoUri = envUri && typeof envUri === 'string' && /^mongodb(\+srv)?:\/\//i.test(envUri);
  if (isValidMongoUri) {
    return {
      connectionString: envUri,
      DBName: process.env.DB_NAME || 'profiling-app'
    };
  }
  const fileConfig = require('./secrets/config.json');
  return { connectionString: fileConfig.connectionString, DBName: fileConfig.DBName };
}
const config = loadConfig();
const DBName = config.DBName;

// Validate MongoDB connection string so we don't spam "Invalid scheme" retries
const connectionString = config.connectionString || process.env.MONGODB_URI;
if (!connectionString || typeof connectionString !== 'string') {
  console.error('\n*** MongoDB connection string is missing. ***');
  console.error('Local dev: set "connectionString" in server/secrets/config.json to your URI (e.g. mongodb+srv://user:pass@cluster.mongodb.net/dbname).');
  console.error('Or set the MONGODB_URI environment variable.');
  process.exit(1);
}
if (!/^mongodb(\+srv)?:\/\//i.test(connectionString)) {
  console.error('\n*** Invalid MongoDB connection string. ***');
  console.error('It must start with "mongodb://" or "mongodb+srv://".');
  console.error('Current value (first 50 chars):', connectionString.substring(0, 50) + (connectionString.length > 50 ? '...' : ''));
  console.error('Fix server/secrets/config.json (connectionString) or MONGODB_URI.');
  process.exit(1);
}

const PORT = process.env.PORT || 5001;

/** Current HTTP server instance; used by graceful shutdown so the port is released when nodemon restarts. */
let httpServer = null;

function gracefulShutdown(signal) {
  if (!httpServer) {
    process.exit(0);
    return;
  }
  console.log(blue(`\n${signal} received, closing server...`));
  httpServer.close(() => {
    console.log('HTTP server closed, port released.');
    mongoose.connection.close(false).then(() => {
      console.log('MongoDB connection closed.');
      process.exit(0);
    }).catch(() => process.exit(0));
  });
  // Force exit after 5s in case close() never fires (e.g. hanging connections)
  setTimeout(() => {
    console.log('Forcing exit after timeout.');
    process.exit(0);
  }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Configure body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Configure CORS
const corsOptions = {
    origin: (origin, callback) => callback(null, true),
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 600 // 10 minutes
};

app.use(cors(corsOptions));

// Render/host health checks need a bound port before MongoDB finishes connecting
app.get('/health', (req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(200).json({ ok: true, db: dbReady ? 'connected' : 'connecting' });
});

// Create uploads directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const profilesDir = path.join(__dirname, 'uploads', 'profiles');
const followersDir = path.join(__dirname, 'uploads', 'followers');
const galleryDir = path.join(__dirname, 'uploads', 'gallery');

[uploadsDir, profilesDir, followersDir, galleryDir].forEach(dir => {
    const relPath = path.relative(__dirname, dir);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`${relPath}: NOT FOUND. Created.`);
    } else {
        console.log(`${relPath}: FOUND`);
    }
});

// ROUTES
app.use('/uploads/profiles', express.static('uploads/profiles'));

// Add this route to list all follower images
app.get('/uploads/followers-images', (req, res) => {
    const dir = path.join(__dirname, 'uploads', 'followers');
    fs.readdir(dir, (err, files) => {
      if (err) return res.status(500).json({ error: 'Unable to scan directory' });
      const images = files.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));
      res.json(images);
    });
});

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.jpg') || filePath.endsWith('.png') || filePath.endsWith('.gif')) {
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Content-Type', `image/${path.extname(filePath).substring(1)}`);
        }
    }
}));

// Serve static files from the Angular assets directory
app.use('/assets', express.static(path.join(__dirname, '../src/assets')));

// Mount the upload routes
app.use('/upload', require('./uploads/upload.routes'));

// Mount the S3 upload routes
app.use('/api/s3-upload', require('./routes/s3-uploads'));

// Mount the hybrid upload routes (S3 + Local storage)
app.use('/api/hybrid-upload', require('./routes/hybrid-uploads'));

// api routes
app.use('/accounts', require('./accounts/accounts.controller'));
app.use('/api/admin/scripts', adminScriptsRouter);

app.use('/admin', require('./controllers/admin.controller'));
app.use('/api/posts', require('./controllers/posts.controller'));
app.use('/api/gallery', require('./gallery/gallery.controller'));
app.use('/api/chat', chatApi);

// Add config route - use the specific function as middleware
const configController = require('./config/config.controller');
app.get('/config', configController.getPublicConfig);

// swagger docs route
app.use('/api-docs', require('./_helpers/swagger'));

// global error handler
app.use(errorHandler);

// Add chalk for color-coded logs if available
let chalk;
try {
  chalk = require('chalk').default;
} catch (e) {
  chalk = null;
}
const green = chalk ? chalk.green : (s) => `\x1b[32m${s}\x1b[0m`;
const blue = chalk ? chalk.blue : (s) => `\x1b[34m${s}\x1b[0m`;
const red = chalk ? chalk.red : (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = chalk ? chalk.yellow : (s) => `\x1b[33m${s}\x1b[0m`;

// Print all registered routes at startup
if (app._router && app._router.stack) {
  app._router.stack
    .filter(r => r.route)
    .forEach(r => {
      console.log('[ROUTE]', r.route.stack[0].method.toUpperCase(), r.route.path);
    });
}

// Connect to MongoDB with retry logic (does not block HTTP listen — required for Render deploy)
function connectWithRetry() {
  if (mongoose.connection.readyState === 0) {
    mongoose.connect(config.connectionString || process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    })
    .then(() => {
      console.log(green('\n\n*** Mongoose connected ***'));
    })
    .catch(err => {
      console.error('MongoDB connection error:', err.message || err);
      console.error('Retrying in 5s. Check MONGODB_URI and Atlas Network Access (allow 0.0.0.0/0 for Render).');
      setTimeout(connectWithRetry, 5000);
    });
  }
}

// Only start the server after Mongoose is connected
function startServer() {
  const server = http.createServer(app);
  httpServer = server; // so gracefulShutdown can close it and release the port
  const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : PORT;

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(red(`\nPort ${port} is already in use.`));
      console.log('Nodemon should wait for the previous process to exit (check delay in server/nodemon.json).');
      console.log('To free the port manually: npx kill-port ' + port);
      process.exit(1);
    }
    throw err;
  });

  server.listen(port, () => {
      console.log(blue(`Server listening on port ${port}`));
      console.log('Connected to DB:', DBName);
      console.log('Environment:', process.env.NODE_ENV || 'development');
      try {
          websocketService.initialize(server);
          console.log(green('Ready for connections... '));
          console.log('--------------------------------');
          console.log(green('Server is ready for connections...'));
      } catch (error) {
          console.error('Failed to initialize WebSocket service:', error);
      }
  });
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

// Listen immediately so Render sees an open PORT; Mongo connects in background
startServer();
connectWithRetry();

app.set('trust proxy', true); // Trust proxy for correct client IP

// Import routes
const accountRoutes = require('./routes/accounts');

// Register routes
app.use('/api/account', accountRoutes);


