const yahooFinance = require('yahoo-finance2').default;
const { format, subMonths, startOfMonth } = require('date-fns');

// Function to fetch and aggregate monthly stock data
async function getMonthlyDataForTickers(tickerList) {
  const endDate = new Date();
  const startDate = startOfMonth(subMonths(endDate, 288));

  const results = [];

  for (const ticker of tickerList) {
    try {
      const data = await yahooFinance.historical(ticker, {
        period1: startDate.toISOString(),
        period2: endDate.toISOString(),
        interval: '1d',
      });

      // Aggregate daily data into monthly and add ticker
      const monthlyData = aggregateMonthly(data, ticker);
      results.push(...monthlyData);
    } catch (error) {
      console.error(`Error fetching data for ${ticker}:`, error.message);
    }
  }

  return results;
}

// Helper function to aggregate daily data into monthly data
function aggregateMonthly(data, ticker) {
  const monthlyData = {};
  data.forEach((item) => {
    const date = new Date(item.date); // Convert to a Date object if not already
    const monthKey = format(date, 'yyyy-MM'); // Format month key, e.g., "2024-12"
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { ...item, ticker }; // Initialize with the first day of the month
    } else {
      monthlyData[monthKey] = { ...item, ticker }; // Update with the last day of the month
    }
  });

  // Format output and return as an array
  return Object.values(monthlyData).map((entry) => ({
    ticker: entry.ticker,
    date: format(new Date(entry.date), 'yyyy-MM-dd'), // Format date as "yyyy-MM-dd"
    close: entry.close,
    open: entry.open,
    high: entry.high,
    low: entry.low,
    volume: entry.volume,
  }));
}

// Example usage
(async () => {
  const tickers = ['^NSEI', 
  'SBIN.NS', 'TCS.NS', 'INFY.NS'
]; // List of ticker symbols

  const monthlyData = await getMonthlyDataForTickers(tickers);

  console.log('Aggregated Monthly Data:\n', JSON.stringify(monthlyData, null, 2));
})();
