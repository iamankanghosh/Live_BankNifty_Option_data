const express = require('express');
const cors = require('cors');
const createMarketRouter = require('./routes/marketRoutes');
const createSeasonalRouter = require('./routes/seasonalRoutes');

function createApp(services = {}) {
  const app = express();

  // Preserve distinct /getData (strike history JSON) and /getdata (seasonal HTML) routes
  app.enable('case sensitive routing');

  app.use(cors());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  app.get('/', (req, res) => {
    res.json({
      msg: 'msg from server',
      status: 'running',
      services: ['market-options', 'seasonal-stocks'],
    });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/', createMarketRouter(services.marketService, services.goldService));
  app.use('/', createSeasonalRouter(services.seasonalService));

  return app;
}

module.exports = createApp;

