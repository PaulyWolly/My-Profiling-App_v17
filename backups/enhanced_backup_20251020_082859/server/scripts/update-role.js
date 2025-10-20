const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../secrets/.env') });
const { MongoClient } = require('mongodb');
const chalk = require('chalk');

async function updateRole() {
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
        
        // Display accounts with their current roles
        console.log(chalk.blue('\nCurrent Accounts:'));
        accounts.forEach((account) => {
            console.log(chalk.cyan(`Email: ${account.email}`));
            console.log(chalk.cyan(`   Name: ${account.firstName} ${account.lastName}`));
            console.log(chalk.cyan(`   Current Role: ${account.role}`));
            console.log('---');
        });

        // Get user input for which account to update
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const email = await new Promise(resolve => {
            readline.question(chalk.yellow('\nEnter the email of the account to update: '), answer => {
                readline.close();
                resolve(answer.trim());
            });
        });

        // Find the account
        const account = await accountsCollection.findOne({ email: email });
        if (!account) {
            throw new Error(`Account with email ${email} not found`);
        }

        const newRole = account.role === 'Admin' ? 'User' : 'Admin';

        // Update the role
        await accountsCollection.updateOne(
            { _id: account._id },
            { 
                $set: { 
                    role: newRole,
                    updated: new Date()
                } 
            }
        );

        console.log(chalk.green(`\nSuccessfully updated ${account.email}'s role to ${newRole}`));

        // Display updated accounts
        const updatedAccounts = await accountsCollection.find({}).toArray();
        console.log(chalk.blue('\nUpdated Accounts:'));
        updatedAccounts.forEach((account) => {
            console.log(chalk.cyan(`Email: ${account.email}`));
            console.log(chalk.cyan(`   Name: ${account.firstName} ${account.lastName}`));
            console.log(chalk.cyan(`   Current Role: ${account.role}`));
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

updateRole(); 