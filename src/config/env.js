const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../../data');

const parseBoolean = (value, defaultValue) => {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
};

module.exports = {
  PORT: Number(process.env.PORT) || 4500,
  DATA_DIR,
  STRIKE_CONFIG_PATH: path.join(DATA_DIR, 'strikeConfig.json'),
  STRIKE_HISTORY_PATH: path.join(DATA_DIR, 'data.json'),
  EARNINGS_DATA_PATH: path.join(DATA_DIR, 'resultData.json'),
  MONGO_URI:
    process.env.MONGO_URI ||
    'mongodb+srv://ankan_user:ankan_user@cluster0.liq1bj6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
  MONGO_DB_NAME: process.env.MONGO_DB_NAME || 'stock_data_lastyear',
  MONGO_COLLECTION_NAME: process.env.MONGO_COLLECTION_NAME || 'monthly_data',
  ENABLE_EARNINGS_SYNC: parseBoolean(process.env.ENABLE_EARNINGS_SYNC, true),
  ENABLE_SEASONAL_SYNC: parseBoolean(process.env.ENABLE_SEASONAL_SYNC, true),
  ENABLE_STRIKE_ALGO: parseBoolean(process.env.ENABLE_STRIKE_ALGO, false),
  SEASONAL_SYNC_INTERVAL_MS: Number(process.env.SEASONAL_SYNC_INTERVAL_MS) || 120 * 60 * 1000,
  EARNINGS_SYNC_INTERVAL_MS: Number(process.env.EARNINGS_SYNC_INTERVAL_MS) || 24 * 60 * 60 * 1000,
  KEEP_ALIVE_URL: process.env.KEEP_ALIVE_URL || '',
};

