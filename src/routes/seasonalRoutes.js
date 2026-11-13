const express = require('express');
const defaultSeasonalService = require('../services/seasonalService');

function createSeasonalRouter(seasonalService = defaultSeasonalService) {
  const router = express.Router({ caseSensitive: true });

  const handleHtmlView = async (req, res) => {
    try {
      const data = await seasonalService.getStockData();
      const html = seasonalService.renderSeasonalHtml(data);
      res.send(html);
    } catch (error) {
      console.error('Error fetching stock data:', error);
      res.status(500).send('Internal Server Error');
    }
  };

  // Lowercase /getdata preserved for seasonal_stock_analysis compatibility
  router.get('/getdata', handleHtmlView);
  router.get('/seasonal/getdata', handleHtmlView);

  router.get('/api/seasonal', async (req, res) => {
    try {
      const data = await seasonalService.getStockData();
      res.json(data);
    } catch (error) {
      console.error('Error fetching seasonal JSON data:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  router.post('/api/seasonal/sync', async (req, res) => {
    try {
      const result = await seasonalService.fetchData();
      res.json({ status: 'ok', ...result });
    } catch (error) {
      console.error('Error syncing seasonal data:', error);
      res.status(500).json({ error: 'Failed to sync seasonal data' });
    }
  });

  return router;
}

module.exports = createSeasonalRouter;

