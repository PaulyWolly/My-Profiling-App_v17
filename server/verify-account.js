require('dotenv').config({ path: './secrets/.env' });
const mongoose = require('mongoose');
const config = require('./secrets/config.json');

async function showAndVerifyAccount() {
    try {
        // Connect to MongoDB
        const connectionString = process.env.MONGODB_URI || config.connectionString;
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
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

showAndVerifyAccount(); 