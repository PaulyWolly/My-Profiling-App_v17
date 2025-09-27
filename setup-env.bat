@echo off
echo Setting up your development environment...

rem Install frontend dependencies
echo Installing frontend dependencies...
call npm install

rem Install backend dependencies
echo Installing backend dependencies...
cd server
call npm install
call npm install express-jwt@8.5.1 --save
cd ..

echo Setup complete! You can now start the application:
echo Frontend: npm start (port 5000)
echo Backend: cd server ^&^& npm start (port 5001)
echo Both: npm run start:all 