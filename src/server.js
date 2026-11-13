const axios = require('axios');
const config = require('./config/env');
const createApp = require('./app');
const marketService = require('./services/marketService');
const seasonalService = require('./services/seasonalService');
const { closeMongo } = require('./db/mongo');

const app = createApp();
const timers = [];

function registerInterval(fn, intervalMs, label) {
  const id = setInterval(async () => {
    try {
      await fn();
    } catch (error) {
      console.error(`Scheduled job "${label}" failed:`, error.message);
    }
  }, intervalMs);
  timers.push(id);
  return id;
}

function startBackgroundJobs() {
  if (config.ENABLE_EARNINGS_SYNC) {
    marketService.refreshEarningsData().catch((err) => {
      console.error('Initial earnings sync failed:', err.message);
    });
    registerInterval(
      () => marketService.refreshEarningsData(),
      config.EARNINGS_SYNC_INTERVAL_MS,
      'earnings-sync'
    );
  }

  if (config.ENABLE_SEASONAL_SYNC) {
    seasonalService.fetchData().catch((err) => {
      console.error('Initial seasonal sync failed:', err.message);
    });
    registerInterval(
      () => seasonalService.fetchData(),
      config.SEASONAL_SYNC_INTERVAL_MS,
      'seasonal-sync'
    );
  }

  if (config.ENABLE_STRIKE_ALGO) {
    registerInterval(
      () => marketService.runStrikeAlgo(),
      60 * 1000,
      'strike-algo'
    );
  }

  if (config.KEEP_ALIVE_URL) {
    registerInterval(
      () => axios.get(config.KEEP_ALIVE_URL),
      30 * 1000,
      'keep-alive'
    );
  }
}

const server = app.listen(config.PORT, () => {
  console.log(`Unified stock_backend server running on port ${config.PORT}`);
  startBackgroundJobs();
});

async function shutdown(signal) {
  console.log(`Received ${signal}; shutting down gracefully...`);
  timers.forEach((id) => clearInterval(id));
  server.close(async () => {
    await closeMongo().catch((err) => console.error('Error closing MongoDB:', err.message));
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

