const chalk = require('chalk');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../secrets/.env') });
const mongoose = require('mongoose');

async function migrateDateToTimestamp() {
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
    const collection = db.collection('scriptruns');

    const count = await collection.countDocuments({ date: { $ne: null, $ne: {} } });
    console.log(chalk.yellow(`Found ${count} documents with a non-empty 'date' field.`));

    console.log(chalk.yellow('Migrating "date.$date" fields to "timestamp"...'));
    const result = await collection.updateMany(
      { date: { $type: 'date' } },
      [
        { $set: { timestamp: "$date" } },
        { $unset: "date" }
      ]
    );

    console.log(chalk.green(`Migration complete. Updated ${result.modifiedCount} documents.`));

    const sample = await collection.findOne({ });
    console.log('Sample doc:', sample);

    const docs = await collection.find({ date: { $exists: true } }).toArray();
    console.log('Docs with date:', docs.length);
    docs.forEach(doc => {
      if (doc.date !== undefined) {
        console.log('date field:', doc.date, 'type:', typeof doc.date, 'instanceof Date:', doc.date instanceof Date);
      }
    });
  } catch (error) {
    console.error(chalk.red('Error during migration:'), error);
  } finally {
    await mongoose.disconnect();
    console.log(chalk.yellow('Disconnected from MongoDB'));
  }
}

migrateDateToTimestamp();
