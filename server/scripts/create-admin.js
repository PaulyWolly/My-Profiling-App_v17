const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const chalk = require('chalk');
const Account = require('../accounts/account.model');
const Role = require('../_helpers/role');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function createAdminAccount() {
    console.log(chalk.blue('--- Create Verified Admin Account Script ---'));
    let dbConnection;

    try {
        const connectionString = process.env.MONGODB_URI;
        if (!connectionString) {
            throw new Error('MONGODB_URI environment variable is not set in server/.env');
        }
        console.log(chalk.yellow('Connecting to MongoDB...'));
        dbConnection = await mongoose.connect(connectionString, {});
        console.log(chalk.green('Connected to MongoDB successfully!'));

        // --- Get Account Details ---
        const email = (await question(chalk.yellow('Enter email address: '))).trim().toLowerCase();
        const firstName = (await question(chalk.yellow('Enter first name: '))).trim();
        const lastName = (await question(chalk.yellow('Enter last name: '))).trim();
        const password = await question(chalk.yellow('Enter password (min 6 chars, input visible): '));
        const confirmPassword = await question(chalk.yellow('Confirm password: '));

        // --- Validate Input ---
        if (!email || !firstName || !lastName || !password || !confirmPassword) {
            throw new Error('All fields are required.');
        }
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters.');
        }
        if (password !== confirmPassword) {
            throw new Error('Passwords do not match.');
        }

        // Check if account already exists
        console.log(`Checking if account exists for: ${email}`);
        const existingAccount = await Account.findOne({ email: email });
        if (existingAccount) {
            throw new Error(`Account with email ${email} already exists.`);
        }

        // --- Create and Save Account ---
        console.log(chalk.yellow(`Creating account for ${email}...`));
        const account = new Account({
            email: email,
            passwordHash: bcrypt.hashSync(password, 10),
            title: 'Mr', // Default or prompt if needed
            firstName: firstName,
            lastName: lastName,
            acceptTerms: true, // Assuming terms accepted for script creation
            role: Role.Admin, // Set role to Admin
            verified: new Date(), // Set as verified immediately
            created: new Date()
        });

        await account.save();
        console.log(chalk.green.bold(`Verified Admin account created successfully for ${email}!`));

    } catch (error) {
        console.error(chalk.red('\n--- Script Error ---'));
        console.error(chalk.red(error.message));
    } finally {
        rl.close();
        if (dbConnection && mongoose.connection.readyState === 1) {
            console.log(chalk.yellow('\nDisconnecting from MongoDB...'));
            await mongoose.disconnect();
            console.log(chalk.green('Disconnected.'));
        }
        console.log(chalk.blue('--- Script Finished ---'));
    }
}

createAdminAccount(); 