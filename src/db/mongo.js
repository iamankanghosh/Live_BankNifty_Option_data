const { MongoClient } = require('mongodb');
const config = require('../config/env');

let client = null;
let connectPromise = null;

/**
 * Returns the shared MongoDB collection instance, connecting lazily on first use.
 */
async function getMonthlyCollection() {
  if (!client) {
    client = new MongoClient(config.MONGO_URI);
  }

  if (!connectPromise) {
    connectPromise = client.connect().catch((err) => {
      connectPromise = null;
      throw err;
    });
  }

  await connectPromise;
  return client.db(config.MONGO_DB_NAME).collection(config.MONGO_COLLECTION_NAME);
}

/**
 * Closes the shared MongoDB connection if open.
 */
async function closeMongo() {
  if (client) {
    const activeClient = client;
    client = null;
    connectPromise = null;
    await activeClient.close();
  }
}

module.exports = {
  getMonthlyCollection,
  closeMongo,
};

