const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const chalk = require('chalk');

async function createMissingAccounts() {
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
        
        // Define accounts to create
        const accountsToCreate = [
            {
                title: 'Mr',
                firstName: 'Bugs',
                lastName: 'Bunny',
                email: 'bugs@example.com',
                password: 'AaBbCc$12345',
                role: 'Admin',
                acceptTerms: true
            },
            {
                title: 'Mr',
                firstName: 'Jesu',
                lastName: 'Christo',
                email: 'jesu@example.com',
                password: 'AaBbCc$12345',
                role: 'User',
                acceptTerms: true
            }
        ];

        // Create each account
        for (const account of accountsToCreate) {
            try {
                // Check if account already exists
                const existingAccount = await accountsCollection.findOne({ email: account.email });
                if (existingAccount) {
                    console.log(chalk.yellow(`Account already exists: ${account.email}`));
                    continue;
                }

                // Hash password
                const hashedPassword = await bcrypt.hash(account.password, 10);
                
                // Create account with current schema
                const newAccount = {
                    ...account,
                    password: hashedPassword,
                    created: new Date(),
                    updated: new Date(),
                    verified: new Date(),
                    profileImage: null
                };

                // Insert account
                await accountsCollection.insertOne(newAccount);
                console.log(chalk.green(`Created account: ${account.email}`));
            } catch (error) {
                console.error(chalk.red(`Error creating account ${account.email}:`, error.message));
            }
        }

        // Verify accounts were created
        const allAccounts = await accountsCollection.find({}).toArray();
        console.log(chalk.blue('\nAll accounts in database:'));
        allAccounts.forEach((account, index) => {
            console.log(chalk.cyan(`[${index + 1}] Email: ${account.email}`));
            console.log(chalk.cyan(`   Name: ${account.firstName} ${account.lastName}`));
            console.log(chalk.cyan(`   Role: ${account.role}`));
            console.log('---');
        });

    } catch (error) {
        console.error(chalk.red('Error:', error.message));
    } finally {
        if (client) {
            await client.close();
        }
    }
}

createMissingAccounts(); 