const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const chalk = require('chalk');
const bcrypt = require('bcrypt');

async function createAccounts() {
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
        
        // Accounts to create
        const accounts = [
            {
                title: 'Mr',
                firstName: 'Bugs',
                lastName: 'Bunny',
                email: 'bbunny@email.com',
                password: 'AaBbCc$12345',
                role: 'Admin',
                acceptTerms: true
            },
            {
                title: 'Mr',
                firstName: 'Test',
                lastName: 'Account',
                email: 'test@test.com',
                password: 'AaBbCc$12345',
                role: 'User',
                acceptTerms: true
            },
            {
                title: 'Mr',
                firstName: 'Jesu',
                lastName: 'Christo',
                email: 'jchristo@email.com',
                password: 'AaBbCc$12345',
                role: 'User',
                acceptTerms: true
            }
        ];
        
        console.log(chalk.yellow(`Creating ${accounts.length} accounts...`));
        
        let createdCount = 0;
        let skippedCount = 0;
        
        // Create each account
        for (const accountData of accounts) {
            try {
                // Check if account already exists
                const existingAccount = await Account.findOne({ email: accountData.email });
                
                if (existingAccount) {
                    console.log(chalk.yellow(`Account already exists: ${accountData.email}`));
                    skippedCount++;
                    continue;
                }
                
                // Hash password
                const hashedPassword = await bcrypt.hash(accountData.password, 10);
                
                // Create account
                const account = new Account({
                    ...accountData,
                    passwordHash: hashedPassword,
                    verified: new Date(),
                    created: new Date(),
                    updated: new Date()
                });
                
                await account.save();
                
                console.log(chalk.green(`Created account: ${accountData.email}`));
                createdCount++;
            } catch (error) {
                console.error(chalk.red(`Error creating account ${accountData.email}:`, error.message));
            }
        }
        
        console.log(chalk.green('\nCreation Summary:'));
        console.log(chalk.green(`Total accounts to create: ${accounts.length}`));
        console.log(chalk.green(`Accounts created: ${createdCount}`));
        console.log(chalk.yellow(`Accounts skipped (already exist): ${skippedCount}`));

    } catch (error) {
        console.error(chalk.red('Error:', error.message));
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
    }
}

createAccounts(); 