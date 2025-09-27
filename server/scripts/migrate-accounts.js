const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../secrets/.env') });
const mongoose = require('mongoose');
const chalk = require('chalk');

async function migrateAccounts() {
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

        // Get the accounts collection
        const Account = require('../accounts/account.model');
        const accountsCollection = mongoose.connection.db.collection('accounts');
        
        // Get all accounts
        const accounts = await accountsCollection.find({}).toArray();
        console.log(chalk.yellow(`Found ${accounts.length} accounts to migrate`));
        
        let migratedCount = 0;
        let skippedCount = 0;
        
        // Migrate each account
        for (const account of accounts) {
            try {
                // Check if account needs migration
                const needsMigration = !account.verified || !account.updated;
                
                if (needsMigration) {
                    // Update account with current schema
                    const update = {
                        $set: {
                            verified: account.verified || new Date(),
                            updated: account.updated || new Date(),
                            // Add any other missing fields with default values
                            title: account.title || 'Mr',
                            acceptTerms: account.acceptTerms || true,
                            profileImage: account.profileImage || null
                        }
                    };
                    
                    await accountsCollection.updateOne(
                        { _id: account._id },
                        update
                    );
                    
                    console.log(chalk.green(`Migrated account: ${account.email}`));
                    migratedCount++;
                } else {
                    console.log(chalk.yellow(`Skipped account (already up to date): ${account.email}`));
                    skippedCount++;
                }
            } catch (error) {
                console.error(chalk.red(`Error migrating account ${account.email}:`, error.message));
            }
        }
        
        console.log(chalk.green('\nMigration Summary:'));
        console.log(chalk.green(`Total accounts processed: ${accounts.length}`));
        console.log(chalk.green(`Accounts migrated: ${migratedCount}`));
        console.log(chalk.yellow(`Accounts skipped (already up to date): ${skippedCount}`));

    } catch (error) {
        console.error(chalk.red('Error:', error.message));
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
    }
}

migrateAccounts(); 