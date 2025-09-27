const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const chalk = require('chalk');

async function fixPasswordHash() {
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
        
        // Get all accounts
        const accounts = await accountsCollection.find({}).toArray();
        console.log(chalk.yellow(`Found ${accounts.length} accounts`));
        
        let updatedCount = 0;
        
        // Update each account
        for (const account of accounts) {
            try {
                // Check if account has password but no passwordHash
                if (account.password && !account.passwordHash) {
                    // Hash the existing password
                    const hashedPassword = await bcrypt.hash(account.password, 10);
                    
                    // Update the account
                    await accountsCollection.updateOne(
                        { _id: account._id },
                        { 
                            $set: { 
                                passwordHash: hashedPassword,
                                updated: new Date()
                            },
                            $unset: { password: "" }
                        }
                    );
                    
                    console.log(chalk.green(`Updated password hash for: ${account.email}`));
                    updatedCount++;
                }
            } catch (error) {
                console.error(chalk.red(`Error updating account ${account.email}:`, error.message));
            }
        }
        
        console.log(chalk.green('\nUpdate Summary:'));
        console.log(chalk.green(`Total accounts processed: ${accounts.length}`));
        console.log(chalk.green(`Accounts updated: ${updatedCount}`));

    } catch (error) {
        console.error(chalk.red('Error:', error.message));
    } finally {
        if (client) {
            await client.close();
        }
    }
}

fixPasswordHash(); 