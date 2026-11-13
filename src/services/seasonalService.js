const { format, subMonths, startOfMonth } = require('date-fns');
const allticker = require('../config/tickers');
const { getMonthlyCollection } = require('../db/mongo');
const { fetchYahooChart, sleep } = require('./yahooClient');

let isSyncing = false;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Aggregates daily OHLCV candles into monthly snapshots and computes month-over-month % change.
 */
function aggregateMonthly(data, ticker) {
  const sortedAsc = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
  const monthlyData = {};

  sortedAsc.forEach((item) => {
    const date = new Date(item.date);
    const monthKey = format(date, 'yyyy-MM');
    monthlyData[monthKey] = { ...item, ticker };
  });

  const monthlyArray = Object.values(monthlyData).map((entry) => ({
    date: format(new Date(entry.date), 'yyyy-MM-dd'),
    ticker: entry.ticker,
    close: entry.close,
    open: entry.open,
    high: entry.high,
    low: entry.low,
    volume: entry.volume,
  }));

  for (let i = 1; i < monthlyArray.length; i += 1) {
    const current = monthlyArray[i];
    const previous = monthlyArray[i - 1];
    if (previous.close) {
      const pchange = ((current.close - previous.close) / previous.close) * 100;
      current.pchange = parseFloat(pchange.toFixed(2));
    } else {
      current.pchange = null;
    }
  }

  if (monthlyArray.length > 0) {
    monthlyArray[0].pchange = null;
  }

  return monthlyArray.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Fetches quote metadata and 50 months of daily history from Yahoo Finance v8 chart API.
 */
async function getMonthlyDataForTickers(
  tickerList = allticker,
  { delayMs = 120, chartFetcher = fetchYahooChart } = {}
) {
  const endDate = new Date();
  const startDate = startOfMonth(subMonths(endDate, 50));
  const period1 = Math.floor(startDate.getTime() / 1000);
  const period2 = Math.floor(endDate.getTime() / 1000);
  const results = [];

  for (let i = 0; i < tickerList.length; i += 1) {
    const ticker = tickerList[i];
    try {
      const { meta, candles } = await chartFetcher(ticker.ticker_id, {
        period1,
        period2,
        interval: '1d',
      });

      if (!candles || candles.length === 0) {
        console.warn(`No Yahoo Finance historical data for ${ticker.ticker_id}`);
        continue;
      }

      const stockName = meta.longName || meta.shortName || 'Unknown';
      results.push({
        ticker: ticker.ticker_id,
        name: stockName,
        result: aggregateMonthly(candles, ticker.ticker_id),
        industry: ticker.industry,
      });
    } catch (error) {
      console.error(`Error fetching data for ${ticker.ticker_id}:`, error.message);
    }

    if (delayMs > 0 && i < tickerList.length - 1) {
      await sleep(delayMs);
    }
  }

  return results;
}

/**
 * Upserts monthly seasonal stock records into MongoDB, preserving existing metadata fields.
 */
async function saveDataToMongoDB(data) {
  const collection = await getMonthlyCollection();

  for (const stockData of data) {
    try {
      const setFields = {
        name: stockData.name,
        result: stockData.result,
        industry: stockData.industry,
      };
      if (stockData.marketCapInCr) {
        setFields.marketCapInCr = stockData.marketCapInCr;
      }
      if (stockData.earningdate) {
        setFields.earningdate = stockData.earningdate;
      }

      await collection.updateOne(
        { ticker: stockData.ticker },
        {
          $set: setFields,
          $setOnInsert: {
            marketCapInCr: stockData.marketCapInCr || 'Unknown',
            earningdate: stockData.earningdate || 'Unknown',
          },
        },
        { upsert: true }
      );
    } catch (error) {
      console.error(`Error saving data for ticker ${stockData.ticker}:`, error.message);
    }
  }

  console.log(`${data.length} stocks' seasonal data saved/updated in MongoDB`);
}

/**
 * Runs a full Yahoo Finance -> MongoDB seasonal sync, guarding against overlapping runs.
 */
async function fetchData() {
  if (isSyncing) {
    console.log('Seasonal sync already in progress; skipping duplicate trigger');
    return { skipped: true };
  }

  isSyncing = true;
  console.log('Seasonal fetchData started');
  try {
    const monthlyData = await getMonthlyDataForTickers(allticker);
    if (monthlyData.length > 0) {
      await saveDataToMongoDB(monthlyData);
    } else {
      console.log('No seasonal data to save');
    }
    return { skipped: false, count: monthlyData.length };
  } catch (error) {
    console.error('Seasonal fetchData failed:', error.message);
    return { skipped: false, error: error.message };
  } finally {
    isSyncing = false;
  }
}

/**
 * Reads seasonal monthly stock records from MongoDB filtered to the last 48 months.
 */
async function getStockData() {
  const collection = await getMonthlyCollection();
  const endDate = new Date();
  const startDate = startOfMonth(subMonths(endDate, 48));

  const allStockData = await collection.find({}).toArray();

  return allStockData.map((stock) => {
    const recentData = (stock.result || [])
      .filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate >= startDate && entryDate <= endDate;
      })
      .slice(0, 48);

    return {
      ticker: stock.ticker,
      name: stock.name,
      result: recentData,
      industry: stock.industry,
      earningdate: stock.earningdate,
      marketCapInCr: stock.marketCapInCr,
    };
  });
}

/**
 * Renders the seasonal monthly performance heatmap HTML page.
 */
function renderSeasonalHtml(data) {
  let html = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Stock Data</title>
        <style>
        body {
            background-color: black;
            color: white;
            font-family: Arial, sans-serif;
        }
        .row {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-start;
        }
        .result-name {
            flex: 1 0 6%;
            margin: 5px;
            text-align: center;
            padding: 10px;
            border-radius: 4px;
            font-weight: bold;
            min-height: 50px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .pchange {
            font-size: 1.5em;
        }
        .date {
            font-size: 0.8em;
            margin-top: 5px;
        }
        .positive {
            background-color: green;
            color: white;
        }
        .negative {
            background-color: red;
            color: white;
        }
        .stock-header {
            font-weight: bold;
            padding-top: 20px;
            margin-bottom: 10px;
            border-top: 2px solid white;
        }
        </style>
    </head>
    <body>
        <div id="stocks-data">`;

  data.forEach((item, index) => {
    html += `
        <div class="stock-container">
            <div class="stock-header">
                ${index + 1}. Ticker: ${escapeHtml(item.ticker)} | Name: ${escapeHtml(item.name)} | mcap: ${escapeHtml(item.marketCapInCr)} | industry: ${escapeHtml(item.industry)} || earning date : ${escapeHtml(item.earningdate)}
            </div>`;

    if (item.result && Array.isArray(item.result)) {
      let rowHtml = '<div class="row">';

      item.result.forEach((subItem, subIndex) => {
        const date = new Date(subItem.date);
        const formattedDate = date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
        const pchangeClass = subItem.pchange < 0 ? 'negative' : 'positive';

        rowHtml += `
                    <div class="result-name ${pchangeClass}">
                        <div class="pchange">${escapeHtml(subItem.pchange)}</div>
                        <div class="date">${escapeHtml(formattedDate)}</div>
                    </div>`;

        if ((subIndex + 1) % 12 === 0 || subIndex === item.result.length - 1) {
          rowHtml += '</div>';
          html += rowHtml;
          rowHtml = '<div class="row">';
        }
      });
    }

    html += `</div>`;
  });

  html += `
    </div>
</body>
</html>`;

  return html;
}

module.exports = {
  aggregateMonthly,
  getMonthlyDataForTickers,
  saveDataToMongoDB,
  fetchData,
  getStockData,
  renderSeasonalHtml,
};

