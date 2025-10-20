# MEAN Stack Profile App with Authentication and Roles

MEAN application (MongoDB, Express, Angular, Node.js) for Profile and Role management with email verification.

## Features
- User authentication with JWT
- Email verification
- Role-based access control (User and Admin roles)
- Profile management
- Image upload for profile and followers

## Setup Instructions

### Quick Setup (Recommended)
After cloning the repository, you can use our setup scripts to automatically install dependencies and configure the environment:

**For Linux/Mac:**
```bash
chmod +x setup-env.sh
./setup-env.sh
```

**For Windows:**
```
setup-env.bat
```

This will:
- Install frontend dependencies
- Install backend dependencies including express-jwt
- Verify port settings (Frontend: 5000, Backend: 5001)
- Configure API URL

### Manual Setup
1. Install frontend dependencies:
   ```
   npm install
   ```

2. Install backend dependencies:
   ```
   cd server
   npm install
   npm install express-jwt@8.5.1 --save
   ```

3. Configure MongoDB connection in `server/config.json`

4. Verify port settings:
   - Backend: Port 5001 in `server/server.js`
   - Frontend: Port 5000 in `package.json` start script
   - API URL: 'http://localhost:5001' in `src/environments/environment.ts`

## Running the Application

**Start Backend (Express server):**
```
cd server
npm start
```

**Start Frontend (Angular app):**
```
npm start
```

**Start Both:**
```
npm run start:all
```

The application will be available at:
- Frontend: http://localhost:5000
- Backend API: http://localhost:5001

## Development

The backend uses MongoDB for data storage. Make sure you have MongoDB installed and running, or use a cloud service like MongoDB Atlas.

## Notes
- The backend will create required upload directories on startup
- Configuration settings are stored in `server/config.json`

# angular-15-signup-verification-using-MongoDB (MEAN)

MEAN application for Profile and Roles managment. Email verififcation and profile management, where Roles are "User" and "Admin"

# Notes
Need to configure MongoDB through Compasss, then run 'nodemon' in server folder.

Now run the Angular app on the root with 'npm start'

# Setup
1. Run 'npm install' to install dependencies in both 'server' and 'root' folders
2. Make sure to configure your MongoDB connection through Compass and update the app.js file.
3. Run 'nodemon' to run the Node/Express server on port 4000
4. Run 'npm start' in the root folder to run the Angular app
# angular15-signup-verify-mongodb-frontend
# my-profiling-app
# my-profiling-app
