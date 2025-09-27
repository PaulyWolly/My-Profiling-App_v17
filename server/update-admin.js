require('dotenv').config({ path: './secrets/.env' });
const mongoose = require('mongoose');
const config = require('./secrets/config.json');
const Role = require('./_helpers/role');

// Use environment variable for MongoDB connection string if available
const connectionString = process.env.MONGODB_URI || config.connectionString;

if (connectionString === 'MONGODB_URI') {
    throw new Error('MongoDB connection string not found in environment variables');
}

async function updateToAdmin() {
    try {
        // Connect to MongoDB
        await mongoose.connect(connectionString, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Find and update the account
        const Account = require('./accounts/account.model');
        const account = await Account.findOne({ email: 'pwelby@gmail.com' });
        
        if (!account) {
            console.log('Account not found!');
            return;
        }

        // Update to Admin and verify
        account.role = Role.Admin;
        account.verified = new Date();
        account.verificationToken = undefined;
        
        await account.save();
        
        console.log('Account updated:', {
            id: account._id,
            email: account.email,
            role: account.role,
            verified: account.verified ? 'Yes' : 'No',
            verificationToken: account.verificationToken ? 'Present' : 'None'
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

updateToAdmin(); 