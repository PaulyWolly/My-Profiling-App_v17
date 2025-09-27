const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const readline = require('readline');
const chalk = require('chalk');
const fs = require('fs');
const Account = require('../accounts/account.model');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function deleteAccount() {
    console.log(chalk.blue('--- Delete Account Script ---'));
    let dbConnection;
    const uploadsDir = path.join(__dirname, '../uploads/profiles');

    try {
        const connectionString = process.env.MONGODB_URI;
        if (!connectionString) {
            throw new Error('MONGODB_URI environment variable is not set in server/.env');
        }
        console.log(chalk.yellow('Connecting to MongoDB...'));
        dbConnection = await mongoose.connect(connectionString, {});
        console.log(chalk.green('Connected to MongoDB successfully!'));

        const email = await question(chalk.yellow('Enter the email address of the account to DELETE: '));
        if (!email) {
            throw new Error('Email address cannot be empty.');
        }
        const normalizedEmail = email.trim().toLowerCase();
        console.log(`Searching for account with email: ${normalizedEmail}`);

        const account = await Account.findOne({ email: normalizedEmail });
        if (!account) {
            console.log(chalk.red(`Error: Account not found for email: ${normalizedEmail}`));
            return; 
        }
        console.log(chalk.green(`Found account: ${account.email} (ID: ${account._id})`));
        const existingImagePath = account.profileImage;

        const confirmation = await question(chalk.red.bold(`\n!!! ARE YOU SURE you want to PERMANENTLY DELETE ${account.email} ??? (Type 'yes' to confirm): `));

        if (confirmation.toLowerCase() !== 'yes') {
            console.log(chalk.yellow('Deletion cancelled.'));
            return;
        }

        console.log(chalk.yellow(`Deleting account record for ${account.email}...`));
        const deleteResult = await Account.deleteOne({ _id: account._id });
        
        if (deleteResult.deletedCount !== 1) {
             throw new Error(`Failed to delete account record ${normalizedEmail}. Delete result: ${JSON.stringify(deleteResult)}`);
        }
        console.log(chalk.green(`Account record ${normalizedEmail} deleted successfully!`));

        if (existingImagePath) {
            const filename = path.basename(existingImagePath);
            const fullFilePath = path.join(uploadsDir, filename);
            
            console.log(chalk.yellow(`Attempting to delete profile image: ${fullFilePath}`));
            if (fs.existsSync(fullFilePath)) {
                try {
                    fs.unlinkSync(fullFilePath);
                    console.log(chalk.green(`Associated profile image deleted successfully.`));
                } catch (fileError) {
                    console.error(chalk.red(`Error deleting profile image file ${fullFilePath}:`), fileError.message);
                }
            } else {
                console.log(chalk.yellow(`Profile image file not found at ${fullFilePath}. Skipping file deletion.`));
            }
        }

        console.log(chalk.green.bold(`Account ${normalizedEmail} and associated data deleted successfully!`));

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

deleteAccount(); 