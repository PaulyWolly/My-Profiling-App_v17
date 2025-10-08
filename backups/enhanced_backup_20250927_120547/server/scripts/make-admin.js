const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../secrets/.env') });
const mongoose = require('mongoose');
const config = require('../secrets/config.json');
const Role = require('../_helpers/role');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function promptEmail() {
    return new Promise((resolve) => {
        rl.question('Enter the email of the user to make admin: ', (email) => {
            resolve(email.trim());
        });
    });
}

async function makeAdmin() {
    try {
        // Get MongoDB connection string from environment
        const connectionString = process.env.MONGODB_URI;
        if (!connectionString) {
            console.log('Current directory:', __dirname);
            console.log('Environment variables:', process.env);
            throw new Error('MONGODB_URI environment variable is not set');
        }

        console.log('Attempting to connect to MongoDB...');
        
        // Connect to MongoDB
        await mongoose.connect(connectionString, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Successfully connected to MongoDB');

        // Get email from user input
        const email = await promptEmail();
        
        // Find the account
        const Account = require('../accounts/account.model');
        const account = await Account.findOne({ email: email });
        
        if (!account) {
            console.log('Account not found!');
            return;
        }

        // Show current state
        console.log('Current account state:', {
            id: account._id,
            email: account.email,
            firstName: account.firstName,
            lastName: account.lastName,
            role: account.role,
            verified: account.verified ? 'Yes' : 'No'
        });

        // Confirm action
        const confirm = await new Promise((resolve) => {
            rl.question('Make this user an Admin? (yes/no): ', (answer) => {
                resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
            });
        });

        if (!confirm) {
            console.log('Operation cancelled');
            return;
        }

        // Update role to Admin
        const originalRole = account.role;
        account.role = Role.Admin;
        
        // Log the change
        console.log('Updating role:', {
            from: originalRole,
            to: account.role
        });

        // Save and verify the change
        await account.save();
        
        // Fetch again to confirm
        const updatedAccount = await Account.findOne({ email: email });
        console.log('Updated account state:', {
            id: updatedAccount._id,
            email: updatedAccount.email,
            firstName: updatedAccount.firstName,
            lastName: updatedAccount.lastName,
            role: updatedAccount.role,
            verified: updatedAccount.verified ? 'Yes' : 'No'
        });

    } catch (error) {
        console.error('Error:', error.message || error);
        if (error.message?.includes('MONGODB_URI')) {
            console.log('\nPlease make sure your .env file contains the MONGODB_URI variable');
        }
    } finally {
        rl.close();
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
    }
}

makeAdmin(); 