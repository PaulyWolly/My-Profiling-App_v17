const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const chalk = require('chalk');

async function updatePwelbyPassword() {
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
        
        // Find Paul Welby's account
        const account = await accountsCollection.findOne({ email: 'pwelby@gmail.com' });
        if (!account) {
            throw new Error('Account not found');
        }

        console.log(chalk.blue('Found account:', {
            email: account.email,
            name: `${account.firstName} ${account.lastName}`,
            role: account.role
        }));

        // Hash the new password
        const hashedPassword = await bcrypt.hash('PJW_1236!', 10);
        
        // Update the account
        await accountsCollection.updateOne(
            { _id: account._id },
            { 
                $set: { 
                    passwordHash: hashedPassword,
                    updated: new Date()
                }
            }
        );
        
        console.log(chalk.green('Successfully updated password for pwelby@gmail.com'));

    } catch (error) {
        console.error(chalk.red('Error:', error.message));
    } finally {
        if (client) {
            await client.close();
        }
    }
}

updatePwelbyPassword(); 