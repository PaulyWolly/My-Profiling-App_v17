require('dotenv').config({ path: './secrets/.env' });
const mongoose = require('mongoose');
const config = require('./secrets/config.json');
const Role = require('./_helpers/role');

async function fixRole() {
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

        // Show current state
        console.log('Current account state:', {
            id: account._id,
            email: account.email,
            role: account.role,
            verified: account.verified ? 'Yes' : 'No'
        });

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
        const updatedAccount = await Account.findOne({ email: 'pwelby@gmail.com' });
        console.log('Updated account state:', {
            id: updatedAccount._id,
            email: updatedAccount.email,
            role: updatedAccount.role,
            verified: updatedAccount.verified ? 'Yes' : 'No'
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

fixRole(); 