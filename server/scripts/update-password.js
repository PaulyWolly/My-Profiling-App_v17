const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const chalk = require('chalk');

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Helper function to prompt for input
const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));

async function updatePassword() {
    try {
        // Connect to MongoDB
        const connectionString = process.env.MONGODB_URI;
        if (!connectionString) {
            throw new Error('MONGODB_URI environment variable is not set');
        }

        await mongoose.connect(connectionString, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log(chalk.green('Connected to MongoDB'));

        // Get Account model
        const Account = require('../accounts/account.model');

        // Prompt for email
        const email = await prompt(chalk.blue('Enter email address: '));
        
        // Find account
        const account = await Account.findOne({ email });
        if (!account) {
            throw new Error(`Account with email ${email} not found`);
        }

        // Prompt for new password
        const password = await prompt(chalk.blue('Enter new password: '));
        if (!password) {
            throw new Error('Password is required');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Update account
        account.passwordHash = passwordHash;
        account.updated = new Date();
        await account.save();

        console.log(chalk.green('\nPassword updated successfully!'));
        console.log(chalk.yellow(`Updated account: ${account.email}`));
        console.log(chalk.yellow(`Update timestamp: ${account.updated}`));

    } catch (error) {
        console.error(chalk.red('Error: ' + error.message));
    } finally {
        // Close readline interface and MongoDB connection
        rl.close();
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
    }
}

updatePassword(); 