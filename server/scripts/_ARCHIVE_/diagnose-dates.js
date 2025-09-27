const chalk = require('chalk');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function diagnoseDates() {
  try {
    const connectionString = process.env.MONGODB_URI;
    if (!connectionString) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    console.log(chalk.yellow('Connecting to MongoDB...'));
    await mongoose.connect(connectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(chalk.green('Connected to MongoDB'));

    const db = mongoose.connection.db;
    console.log('Using connection string:', connectionString);
    console.log('Using database:', db.databaseName);

    const collection = db.collection('scriptruns');

    const count = await collection.countDocuments({ date: { $type: 'date' } });
    console.log(chalk.yellow(`Found ${count} documents with a native Date in 'date' field.`));

    const docs = await collection.find({}).limit(10).toArray();
    console.log('docs.length:', docs.length);
    console.log('docs:', docs);
    docs.forEach((doc, idx) => {
      console.log(
        `Doc #${idx + 1} _id=${doc._id}`,
        '\n  fields:', Object.keys(doc)
      );
    });
  } catch (error) {
    console.error(chalk.red('Error during diagnosis:'), error);
  } finally {
    await mongoose.disconnect();
    console.log(chalk.yellow('Disconnected from MongoDB'));
  }
}

diagnoseDates();
