const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../secrets/.env') });
const { MongoClient } = require('mongodb');
const chalk = require('chalk');

async function updateAccounts() {
    let client;
    try {
        // Connect to MongoDB
        const connectionString = process.env.MONGODB_URI;
        if (!connectionString) {
            throw new Error('MONGODB_URI environment variable is not set');
        }
        
        console.log(chalk.blue('Connecting to MongoDB with URI:', connectionString));
        client = new MongoClient(connectionString);
        await client.connect();
        console.log(chalk.green('Connected to MongoDB'));

        const db = client.db();
        const accountsCollection = db.collection('accounts');
        
        // Get collection stats
        const stats = await accountsCollection.stats();
        console.log(chalk.blue('\nCollection Stats:'));
        console.log(chalk.blue(`Collection name: ${stats.ns}`));
        console.log(chalk.blue(`Document count: ${stats.count}`));
        
        // Try to find all accounts with different queries
        console.log(chalk.yellow('\nTrying different queries to find accounts:'));
        
        // Query 1: Basic find
        const accounts1 = await accountsCollection.find({}).toArray();
        console.log(chalk.cyan(`\nQuery 1 (find all): Found ${accounts1.length} accounts`));
        
        // Query 2: Find with projection
        const accounts2 = await accountsCollection.find({}, { projection: { _id: 1, email: 1 } }).toArray();
        console.log(chalk.cyan(`Query 2 (with projection): Found ${accounts2.length} accounts`));
        
        // Query 3: Find with specific fields
        const accounts3 = await accountsCollection.find({}, { 
            projection: { 
                _id: 1, 
                email: 1, 
                firstName: 1, 
                lastName: 1, 
                role: 1,
                verified: 1,
                updated: 1,
                title: 1,
                acceptTerms: 1
            } 
        }).toArray();
        console.log(chalk.cyan(`Query 3 (specific fields): Found ${accounts3.length} accounts`));
        
        // Log all accounts found
        console.log(chalk.blue('\nAccounts found:'));
        accounts3.forEach((account, index) => {
            console.log(chalk.cyan(`[${index + 1}] ID: ${account._id}`));
            console.log(chalk.cyan(`   Email: ${account.email}`));
            console.log(chalk.cyan(`   First Name: ${account.firstName}`));
            console.log(chalk.cyan(`   Last Name: ${account.lastName}`));
            console.log(chalk.cyan(`   Role: ${account.role}`));
            console.log(chalk.cyan(`   Verified: ${account.verified || 'Not set'}`));
            console.log(chalk.cyan(`   Updated: ${account.updated || 'Not set'}`));
            console.log(chalk.cyan(`   Title: ${account.title || 'Not set'}`));
            console.log(chalk.cyan(`   Accept Terms: ${account.acceptTerms || 'Not set'}`));
            console.log('---');
        });
        
        let updatedCount = 0;
        let skippedCount = 0;
        
        // Update each account
        for (const account of accounts3) {
            try {
                // Check if account needs update
                const needsUpdate = !account.verified || !account.updated || !account.title || !account.acceptTerms;
                
                if (needsUpdate) {
                    // Update account with current schema
                    const update = {
                        $set: {
                            verified: account.verified || new Date(),
                            updated: account.updated || new Date(),
                            title: account.title || 'Mr',
                            acceptTerms: account.acceptTerms || true,
                            profileImage: account.profileImage || null
                        }
                    };
                    
                    await accountsCollection.updateOne(
                        { _id: account._id },
                        update
                    );
                    
                    console.log(chalk.green(`Updated account: ${account.email}`));
                    updatedCount++;
                } else {
                    console.log(chalk.yellow(`Skipped account (already up to date): ${account.email}`));
                    skippedCount++;
                }
            } catch (error) {
                console.error(chalk.red(`Error updating account ${account.email}:`, error.message));
            }
        }
        
        console.log(chalk.green('\nUpdate Summary:'));
        console.log(chalk.green(`Total accounts processed: ${accounts3.length}`));
        console.log(chalk.green(`Accounts updated: ${updatedCount}`));
        console.log(chalk.yellow(`Accounts skipped (already up to date): ${skippedCount}`));

    } catch (error) {
        console.error(chalk.red('Error:', error.message));
    } finally {
        if (client) {
            await client.close();
        }
    }
}

updateAccounts(); 