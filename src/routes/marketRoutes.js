const express = require('express');
const defaultMarketService = require('../services/marketService');
const defaultGoldService = require('../services/goldService');

function handleRouteError(res, error, fallbackMessage) {
  const status = error.status || 500;
  console.error(`${fallbackMessage}:`, error.message);
  return res.status(status).json({ error: error.status ? error.message : fallbackMessage });
}

function createMarketRouter(
  marketService = defaultMarketService,
  goldService = defaultGoldService
) {
  const router = express.Router({ caseSensitive: true });

  const handleIndexRoute = (indexId, errorMessage) => async (req, res) => {
    try {
      const data = await marketService.fetchMoneycontrolIndex(indexId);
      res.send(data);
    } catch (error) {
      handleRouteError(res, error, errorMessage);
    }
  };

  router.get('/banknifty', handleIndexRoute(23, 'Failed to fetch data from Moneycontrol API'));
  router.get('/nifty50', handleIndexRoute(9, 'Failed to fetch data from Moneycontrol API nifty50'));

  const handleOptionRoute = (optionType) => async (req, res) => {
    try {
      const data = await marketService.fetchOptionStrikeData(optionType);
      res.json(data);
    } catch (error) {
      handleRouteError(res, error, 'Error fetching data');
    }
  };

  router.get('/upstox/call/fetchData', handleOptionRoute('call'));
  router.get('/upstox/put/fetchData', handleOptionRoute('put'));

  router.post('/updateData/:key', async (req, res) => {
    try {
      await marketService.updateStrikeConfig(req.params.key, req.body?.value);
      res.status(200).send('Data updated successfully');
    } catch (error) {
      const status = error.status || 500;
      const message = error.status ? error.message : 'Error updating data';
      if (!error.status) {
        console.error('Error updating strike config:', error);
      }
      res.status(status).send(message);
    }
  });

  router.get('/strikeConfig', async (req, res) => {
    try {
      const config = await marketService.readStrikeConfig();
      res.json(config);
    } catch (error) {
      handleRouteError(res, error, 'Error reading strike config');
    }
  });

  router.get('/fetchSVG', async (req, res) => {
    try {
      const svgData = await marketService.fetchNseSvg(req.query.symbol);
      res.set('Content-Type', 'image/svg+xml');
      res.send(svgData);
    } catch (error) {
      handleRouteError(res, error, 'Error fetching SVG');
    }
  });

  // CamelCase /getData preserved for Live_BankNifty_Option_data compatibility
  router.get('/getData', async (req, res) => {
    try {
      const data = await marketService.readStrikeHistory();
      res.json(data);
    } catch (error) {
      handleRouteError(res, error, 'Error fetching data');
    }
  });

  router.get('/resultData', async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 500));
      const data = await marketService.readEarningsData(limit);
      res.json(data);
    } catch (error) {
      handleRouteError(res, error, 'Error fetching data');
    }
  });

  router.post('/api/earnings/refresh', async (req, res) => {
    try {
      const count = await marketService.refreshEarningsData();
      res.json({ status: 'ok', count });
    } catch (error) {
      handleRouteError(res, error, 'Error refreshing earnings data');
    }
  });

  const handleGoldRoute = async (req, res) => {
    try {
      const data = await goldService.fetchGoldAndEtfPrices({ city: req.query.city });
      res.json(data);
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch gold and ETF prices');
    }
  };

  router.get('/gold', handleGoldRoute);
  router.get('/api/gold', handleGoldRoute);

  return router;
}

module.exports = createMarketRouter;

