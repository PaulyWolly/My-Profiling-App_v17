require('dotenv').config({ path: './secrets/.env' });
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
function loadConfig() {
  if (process.env.MONGODB_URI) {
    return {
      connectionString: process.env.MONGODB_URI,
      DBName: process.env.DB_NAME || 'profiling-app'
    };
  }
  const fileConfig = require('./secrets/config.json');
  return { connectionString: fileConfig.connectionString, DBName: fileConfig.DBName };
}
const config = loadConfig();
const DBName = config.DBName;

const PORT = process.env.PORT || 5001;

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

// Create uploads directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const profilesDir = path.join(__dirname, 'uploads', 'profiles');
const followersDir = path.join(__dirname, 'uploads', 'followers');

[uploadsDir, profilesDir, followersDir].forEach(dir => {
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

// Print all registered routes at startup
app._router.stack
  .filter(r => r.route)
  .forEach(r => {
    console.log('[ROUTE]', r.route.stack[0].method.toUpperCase(), r.route.path);
  });

// Connect to MongoDB with retry logic
function connectWithRetry() {
  if (mongoose.connection.readyState === 0) { // Only connect if not already connected
    mongoose.connect(config.connectionString || process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    })
    .then(() => {
      console.log(green('\n\n*** Mongoose connected ***'));
      startServer();
    })
    .catch(err => {
      console.error('MongoDB connection error:', err);
      setTimeout(connectWithRetry, 5000);
    });
  }
}

// Only start the server after Mongoose is connected
function startServer() {
  // Create HTTP server
  const server = http.createServer(app);
  // Start server
  const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : PORT;
  server.listen(port, () => {
      console.log(blue(`Server listening on port ${port}`));
      console.log('Connected to DB:', DBName);
      console.log('Environment:', process.env.NODE_ENV || 'development');
      // Initialize WebSocket service after server is listening
      try {
          websocketService.initialize(server);
          console.log(green('Ready for connections... '));
          console.log('--------------------------------')
          // Add green 'Server is ready for connections...' after WebSocket group
          console.log(green('Server is ready for connections...'));
      } catch (error) {
          console.error('Failed to initialize WebSocket service:', error);
      }
  });
}

// Initial connection
connectWithRetry();

app.set('trust proxy', true); // Trust proxy for correct client IP

// Import routes
const accountRoutes = require('./routes/accounts');

// Register routes
app.use('/api/account', accountRoutes);


