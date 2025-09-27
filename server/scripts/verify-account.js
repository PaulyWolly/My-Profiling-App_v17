const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../secrets/.env') });
const mongoose = require('mongoose');
const config = require('../secrets/config.json');

async function showAndVerifyAccount() {
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

        // Show account details including verification token
        console.log('Account found:', {
            id: account._id,
            email: account.email,
            role: account.role,
            verified: account.verified ? 'Yes' : 'No',
            verificationToken: account.verificationToken
        });

        // Verify the account
        account.verified = new Date();
        account.verificationToken = undefined;
        await account.save();
        
        console.log('Account verified successfully');

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

showAndVerifyAccount(); 