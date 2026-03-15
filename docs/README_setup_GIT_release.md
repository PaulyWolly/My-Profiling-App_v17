# Angular User Management Application - Setup and Release Guide

## Application Overview
This application is an Angular-based user management system with MongoDB integration. It includes:
- User authentication with JWT tokens
- Account management (create, update, delete)
- Email verification
- Admin controls
- Profile image upload functionality
- Multiple profile template designs for users
- MongoDB database integration

## Setup Instructions

### Prerequisites
- Node.js (v14 or later)
- npm (v6 or later)
- MongoDB Atlas account (or local MongoDB instance)
- Git

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```

2. **Install dependencies for both client and server**
   ```bash
   # Install client dependencies
   npm install
   
   # Install server dependencies
   cd server
   npm install
   cd ..
   ```

3. **Configure Environment Variables**
   
   The server requires certain environment variables for proper functioning:
   - `MONGODB_URI`: Your MongoDB connection string
   - `SMTP_APP_PASSWORD`: Password for email functionality

   You can set these in your environment or create a `.env` file in the server directory.

4. **Configure server/config.json**
   
   Make sure to update the config.json file with your specific settings:
   - MongoDB connection string
   - JWT secret
   - Email configuration

5. **Start the application**
   ```bash
   # Start both client and server
   npm run start:all
   
   # Or start them separately
   npm start        # For Angular frontend
   cd server && npm start  # For Node.js backend
   ```

6. **Access the application**
   
   Navigate to `http://localhost:4445` in your browser.

## GitHub Release Process

To create a new GitHub release:

1. **Ensure all changes are committed**
   ```bash
   git status
   git add .
   git commit -m "Description of changes"
   ```

2. **Create a version tag**
   ```bash
   git tag -a v1.0.0 -m "Release description"
   ```

3. **Push the tag to GitHub**
   ```bash
   git push origin v1.0.0
   ```

4. **Create the release on GitHub**
   - Go to your repository on GitHub.com
   - Navigate to "Releases" section
   - Click "Create a new release" or "Draft a new release"
   - Select the tag you just pushed
   - Add a title and description
   - Include notable changes, new features, and bug fixes
   - Click "Publish release"

## Troubleshooting

### MongoDB Connection Issues
If you experience MongoDB disconnection:
- The application now has automatic reconnection logic
- Check your network connection
- Verify MongoDB Atlas service status
- Check your IP whitelist in MongoDB Atlas

### Email Verification Issues
- Ensure SMTP credentials are correct
- Check spam folder for verification emails
- Verify the email service is allowing application access

## Version History

### v1.0.0
- Initial stable release
- User authentication with JWT tokens
- Account management functionality
- Email verification
- Admin controls
- Profile image upload
- Working delete functionality
- Improved MongoDB connection reliability

## Features

### Profile Templates
The application offers three distinct profile templates that users can choose from:

1. **Standard Profile** - Basic professional profile layout with user information, location, and social links
2. **Business Card** - Professional contact card-style layout with ratings and work information
3. **Social Media** - Twitter-inspired layout showing follower counts and connection information

Users can switch between these templates at any time through their profile settings. All content will automatically refresh and adapt to the selected template design.

To implement a new template:

1. Create a new component in `src/app/profile/templates/`
2. Update the profile selection service in `src/app/profile/profile-template.service.ts`
3. Add the template option to the profile settings form

## License
This project is licensed under the MIT License - see the LICENSE file for details. 