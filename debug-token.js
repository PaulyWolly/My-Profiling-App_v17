// Debug script to check JWT token expiration
const jwt = require('jsonwebtoken');

// Sample JWT token (replace with actual token from browser)
const sampleToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzVhYjQ5YzQ0YzQ0YzQ0YzQ0YzQ0YzQiLCJpZCI6IjY3NWFiNDljNDRjNDRjNDRjNDRjNDRjNCIsInJvbGUiOiJVc2VyIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNzM1MzQ0ODAwLCJleHAiOjE3MzUzNDY2MDB9.sample';

function debugToken(token) {
    try {
        // Decode without verification to see the payload
        const decoded = jwt.decode(token, { complete: true });

        if (decoded) {
            console.log('Token Header:', decoded.header);
            console.log('Token Payload:', decoded.payload);

            const now = Math.floor(Date.now() / 1000);
            const exp = decoded.payload.exp;
            const timeLeft = exp - now;

            console.log('Current time:', now);
            console.log('Expiration time:', exp);
            console.log('Time left (seconds):', timeLeft);
            console.log('Time left (minutes):', Math.round(timeLeft / 60));
            console.log('Is expired:', timeLeft <= 0);
        } else {
            console.log('Invalid token format');
        }
    } catch (error) {
        console.error('Error decoding token:', error.message);
    }
}

// Test with a sample 30-minute token
const testPayload = {
    sub: '675ab49c44c44c44c44c44c4',
    id: '675ab49c44c44c44c44c44c4',
    role: 'User',
    email: 'test@example.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes from now
};

const testToken = jwt.sign(testPayload, 'test-secret');
console.log('Testing 30-minute token:');
debugToken(testToken);

console.log('\n--- Instructions ---');
console.log('1. Open browser developer tools');
console.log('2. Go to Application/Storage > Session Storage');
console.log('3. Find the JWT token value');
console.log('4. Run: node debug-token.js "YOUR_TOKEN_HERE"');

