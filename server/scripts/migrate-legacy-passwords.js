const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../secrets/.env') });
const { MongoClient } = require('mongodb');
const chalk = require('chalk');

async function migrateLegacyPasswords() {
    let client;
    try {
        // Connect to MongoDB
        const connectionString = process.env.MONGODB_URI;
        if (!connectionString) {
            throw new Error('MONGODB_URI environment variable is not set');
        }

        console.log(chalk.blue('Connecting to MongoDB...'));
        client = new MongoClient(connectionString);
        await client.connect();
        console.log(chalk.green('Connected to MongoDB'));

        const db = client.db();
        const accountsCollection = db.collection('accounts');

        // Find accounts without plainPassword field
        const legacyAccounts = await accountsCollection.find({
            plainPassword: { $exists: false }
        }).toArray();

        console.log(chalk.blue(`Found ${legacyAccounts.length} legacy accounts without plainPassword field`));

        if (legacyAccounts.length === 0) {
            console.log(chalk.green('No legacy accounts found. All accounts already have plainPassword field.'));
            return;
        }

        console.log(chalk.yellow('\nLegacy accounts found:'));
        legacyAccounts.forEach(account => {
            console.log(chalk.yellow(`- ${account.email} (${account.firstName} ${account.lastName}) - Role: ${account.role}`));
        });

        console.log(chalk.red('\n⚠️  WARNING: Legacy accounts cannot have their original passwords retrieved.'));
        console.log(chalk.red('   The original passwords are hashed and cannot be reversed.'));
        console.log(chalk.red('   You will need to reset passwords for these accounts to enable password visibility.'));

        console.log(chalk.blue('\nOptions:'));
        console.log(chalk.blue('1. Reset passwords for all legacy accounts (recommended)'));
        console.log(chalk.blue('2. Set a default password for all legacy accounts'));
        console.log(chalk.blue('3. Skip migration (accounts will need individual password resets)'));

        // For now, we'll just mark them as needing password reset
        console.log(chalk.yellow('\nMarking legacy accounts for password reset...'));

        const result = await accountsCollection.updateMany(
            { plainPassword: { $exists: false } },
            {
                $set: {
                    plainPassword: null, // Mark as null to indicate legacy account
                    needsPasswordReset: true,
                    migrationDate: new Date()
                }
            }
        );

        console.log(chalk.green(`\nMigration completed!`));
        console.log(chalk.green(`Updated ${result.modifiedCount} legacy accounts.`));
        console.log(chalk.yellow('\nNext steps:'));
        console.log(chalk.yellow('1. Use the Super-Admin interface to reset passwords for these accounts'));
        console.log(chalk.yellow('2. Or use the reset password functionality in the Accounts table'));
        console.log(chalk.yellow('3. After reset, passwords will be visible and stored in plain text'));

    } catch (error) {
        console.error(chalk.red('Error:', error.message));
    } finally {
        if (client) {
            await client.close();
        }
    }
}

// Run the migration
migrateLegacyPasswords();
