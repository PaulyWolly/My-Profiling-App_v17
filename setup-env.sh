#!/bin/bash
# setup-env.sh - Script to set up development environment after cloning the repository

echo "Setting up your development environment..."

# Install frontend dependencies
echo "Installing frontend dependencies..."
npm install

# Install backend dependencies
echo "Installing backend dependencies..."
cd server
npm install
npm install express-jwt@8.5.1 --save
cd ..

# Verify port settings
echo "Verifying port settings..."

# Check frontend port in package.json
if ! grep -q "\"start\": \"ng serve --open --port 5000\"" package.json; then
  echo "Setting frontend port to 5000..."
  sed -i 's/"start": "ng serve --open"/"start": "ng serve --open --port 5000"/g' package.json
  sed -i 's/"start": "ng serve"/"start": "ng serve --open --port 5000"/g' package.json
fi

# Check backend port in server.js
if ! grep -q "port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 5001;" server/server.js; then
  echo "Setting backend port to 5001..."
  sed -i 's/port = process.env.NODE_ENV === .*/port = process.env.NODE_ENV === "production" ? (process.env.PORT || 80) : 5001;/' server/server.js
fi

# Check API URL in environment.ts
if ! grep -q "apiUrl: 'http://localhost:5001'" src/environments/environment.ts; then
  echo "Setting API URL to http://localhost:5001..."
  sed -i 's/apiUrl: .*/apiUrl: "http:\/\/localhost:5001"/' src/environments/environment.ts
fi

echo "Setup complete! You can now start the application:"
echo "Frontend: npm start (port 5000)"
echo "Backend: cd server && npm start (port 5001)"
echo "Both: npm run start:all" 