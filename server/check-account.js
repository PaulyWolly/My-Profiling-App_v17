require('dotenv').config();
const mongoose = require('mongoose');
const config = require('./config.json');
const bcrypt = require('bcryptjs');
const Role = require('./_helpers/role');

// Use environment variable for MongoDB connection string if available
const connectionString = process.env.MONGODB_URI || config.connectionString;

if (connectionString === 'MONGODB_URI') {
    throw new Error('MongoDB connection string not found in environment variables');
}

async function checkAccount() {
    try {
        // Connect to MongoDB
        await mongoose.connect(connectionString, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Find the account
        const Account = require('./accounts/account.model');
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
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkAccount(); 