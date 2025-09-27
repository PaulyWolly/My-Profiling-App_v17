const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const config = require('../config.json');
const bcrypt = require('bcryptjs');

async function checkAccount() {
    try {
        // Get MongoDB connection string from environment
        const connectionString = process.env.MONGODB_URI;
        if (!connectionString) {
            throw new Error('MONGODB_URI environment variable is not set');
        }

        console.log('Attempting to connect to MongoDB...');
        
        // Connect to MongoDB
        await mongoose.connect(connectionString, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Successfully connected to MongoDB');

        // Find the account
        const Account = require('../accounts/account.model');
        const account = await Account.findOne({ email: 'pwelby@gmail.com' });
        
        if (!account) {
            console.log('Account not found!');
            return;
        }

        // Print account details
        console.log('Account found:', {
            id: account._id,
            email: account.email,
            role: account.role,
            verified: account.verified ? 'Yes' : 'No',
            verificationToken: account.verificationToken ? 'Present' : 'None',
            passwordHash: account.passwordHash ? 'Present' : 'Missing'
        });

        // Test password
        const testPassword = 'PJW_1236!';
        const passwordValid = bcrypt.compareSync(testPassword, account.passwordHash);
        console.log('Password test:', {
            testPassword,
            isValid: passwordValid
        });

    } catch (error) {
        console.error('Error:', error.message || error);
        if (error.message?.includes('MONGODB_URI')) {
            console.log('\nPlease make sure your .env file contains the MONGODB_URI variable');
        }
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
    }
}

checkAccount(); 