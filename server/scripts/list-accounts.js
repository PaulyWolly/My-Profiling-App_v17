const chalk = require('chalk');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../secrets/.env') });
const mongoose = require('mongoose');
const config = require('../secrets/config.json');

// Default pagination settings
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PAGE_NUMBER = 1;

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        pageSize: DEFAULT_PAGE_SIZE,
        pageNumber: DEFAULT_PAGE_NUMBER,
        debug: false
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--page-size' || args[i] === '-s') {
            options.pageSize = parseInt(args[i + 1], 10);
            if (isNaN(options.pageSize) || options.pageSize < 1) {
                console.error(chalk.red('Error: Page size must be a positive number'));
                process.exit(1);
            }
        } else if (args[i] === '--page' || args[i] === '-p') {
            options.pageNumber = parseInt(args[i + 1], 10);
            if (isNaN(options.pageNumber) || options.pageNumber < 1) {
                console.error(chalk.red('Error: Page number must be a positive number'));
                process.exit(1);
            }
        } else if (args[i] === '--debug' || args[i] === '-d') {
            options.debug = true;
        }
    }

    return options;
}

async function listAccounts() {
    const options = parseArgs();
    
    try {
        // Connect to MongoDB
        const connectionString = process.env.MONGODB_URI;
        if (!connectionString) {
            throw new Error('MONGODB_URI environment variable is not set');
        }
        
        // Enable debug mode for mongoose
        mongoose.set('debug', true);
        
        if (options.debug) {
            console.log(chalk.yellow('Debug: Connection string:', connectionString));
        }
        
        await mongoose.connect(connectionString, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log(chalk.green('Connected to MongoDB'));

        // Get all accounts
        const Account = require('../accounts/account.model');
        
        // Log the connection details
        console.log(chalk.yellow('Database:', mongoose.connection.db.databaseName));
        console.log(chalk.yellow('Collection:', mongoose.connection.db.collection('accounts').collectionName));
        
        // Get total count using both methods
        const mongooseCount = await Account.countDocuments();
        const rawCount = await mongoose.connection.db.collection('accounts').countDocuments();
        
        if (options.debug) {
            console.log(chalk.yellow(`Debug: Mongoose count: ${mongooseCount}`));
            console.log(chalk.yellow(`Debug: Raw MongoDB count: ${rawCount}`));
            
            // List all collections in the database
            const collections = await mongoose.connection.db.listCollections().toArray();
            console.log(chalk.yellow('\nCollections in database:'));
            collections.forEach(col => console.log(chalk.yellow(`- ${col.name}`)));
            
            // Get raw documents without any filtering
            const allDocs = await mongoose.connection.db.collection('accounts').find({}).toArray();
            console.log(chalk.yellow('\nAll documents in accounts collection:'));
            allDocs.forEach(doc => {
                console.log(chalk.yellow(`- ID: ${doc._id}`));
                console.log(chalk.yellow(`  Email: ${doc.email}`));
                console.log(chalk.yellow(`  Role: ${doc.role}`));
                console.log(chalk.yellow(`  Verified: ${doc.verified ? 'Yes' : 'No'}`));
            });
        }
        
        const totalCount = rawCount; // Use raw count as source of truth
        const totalPages = Math.ceil(totalCount / options.pageSize);
        
        // Validate page number
        if (options.pageNumber > totalPages) {
            console.log(chalk.yellow(`Warning: Page ${options.pageNumber} is out of range. Showing page ${totalPages} instead.`));
            options.pageNumber = totalPages;
        }
        
        // Get paginated accounts using both methods
        const mongooseAccounts = await Account.find({})
            .sort({ created: -1 })
            .skip((options.pageNumber - 1) * options.pageSize)
            .limit(options.pageSize)
            .lean();
            
        const rawAccounts = await mongoose.connection.db.collection('accounts')
            .find({})
            .sort({ created: -1 })
            .skip((options.pageNumber - 1) * options.pageSize)
            .limit(options.pageSize)
            .toArray();
            
        if (options.debug) {
            console.log(chalk.yellow(`Debug: Mongoose accounts found: ${mongooseAccounts.length}`));
            console.log(chalk.yellow(`Debug: Raw MongoDB accounts found: ${rawAccounts.length}`));
            
            // Compare the two result sets
            const mongooseIds = mongooseAccounts.map(a => a._id.toString());
            const rawIds = rawAccounts.map(a => a._id.toString());
            
            console.log(chalk.yellow('\nComparing result sets:'));
            console.log(chalk.yellow('Mongoose IDs:', mongooseIds));
            console.log(chalk.yellow('Raw MongoDB IDs:', rawIds));
            
            const missingInMongoose = rawIds.filter(id => !mongooseIds.includes(id));
            const missingInRaw = mongooseIds.filter(id => !rawIds.includes(id));
            
            if (missingInMongoose.length > 0) {
                console.log(chalk.red('\nAccounts found in raw query but missing in Mongoose:'));
                missingInMongoose.forEach(id => {
                    const account = rawAccounts.find(a => a._id.toString() === id);
                    console.log(chalk.red(`- ID: ${id}, Email: ${account.email}`));
                });
            }
            
            if (missingInRaw.length > 0) {
                console.log(chalk.red('\nAccounts found in Mongoose but missing in raw query:'));
                missingInRaw.forEach(id => {
                    const account = mongooseAccounts.find(a => a._id.toString() === id);
                    console.log(chalk.red(`- ID: ${id}, Email: ${account.email}`));
                });
            }
        }
        
        // Use raw accounts as source of truth
        const accounts = rawAccounts;
        
        console.log(chalk.green(`\nTotal accounts: ${totalCount}`));
        console.log(chalk.green(`Page ${options.pageNumber} of ${totalPages} (${options.pageSize} accounts per page)\n`));
        
        if (accounts.length === 0) {
            console.log(chalk.red('No accounts found in database'));
            return;
        }

        console.log(chalk.green(`Showing ${accounts.length} accounts:\n`));
        
        // List accounts with more details
        accounts.forEach((account, index) => {
            const accountNumber = (options.pageNumber - 1) * options.pageSize + index + 1;
            console.log(chalk.blue(`=== Account ${accountNumber} ===`));
            
            // Format each field as a string with proper color
            const output = [
                `id: ${chalk.magenta(account._id)}`,
                `email: ${chalk.green(account.email)}`,
                `title: ${chalk.yellow(account.title || 'N/A')}`,
                `firstName: ${chalk.yellow(account.firstName)}`,
                `lastName: ${chalk.yellow(account.lastName)}`,
                `role: ${account.role === 'Admin' ? chalk.red(account.role) : chalk.green(account.role)}`,
                `verified: ${account.verified ? chalk.green(new Date(account.verified).toLocaleString()) : chalk.red('No')}`,
                `created: ${chalk.yellow(new Date(account.created).toLocaleString())}`,
                `updated: ${chalk.yellow(account.updated ? new Date(account.updated).toLocaleString() : 'N/A')}`,
                `hasProfileImage: ${chalk.yellow(account.profileImage ? 'Yes' : 'No')}`
            ].join('\n');
            
            console.log(output);
            console.log('');
        });

        // Show pagination controls
        console.log(chalk.blue('\nPagination Controls:'));
        console.log(chalk.yellow(`To view next page: node scripts/list-accounts.js -p ${options.pageNumber + 1}`));
        if (options.pageNumber > 1) {
            console.log(chalk.yellow(`To view previous page: node scripts/list-accounts.js -p ${options.pageNumber - 1}`));
        }
        console.log(chalk.yellow(`To change page size: node scripts/list-accounts.js -s <number>`));
        console.log(chalk.yellow(`To enable debug mode: node scripts/list-accounts.js -d`));

    } catch (error) {
        console.error(chalk.red('Error: ' + error.message));
        if (options.debug) {
            console.error(chalk.red('Stack trace:', error.stack));
        }
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
    }
}

listAccounts(); 