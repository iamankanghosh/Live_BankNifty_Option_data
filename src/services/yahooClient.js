const axios = require('axios');

const YF_CHART_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Accept: 'application/json',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches chart metadata and OHLCV candles for a symbol from Yahoo Finance v8 chart API.
 * Retries once with backoff if rate-limited (HTTP 429).
 */
async function fetchYahooChart(
  symbol,
  { period1, period2, interval = '1d', timeout = 10000, retryDelayMs = 1500 } = {}
) {
  const params = { interval };
  if (period1 !== undefined) params.period1 = period1;
  if (period2 !== undefined) params.period2 = period2;

  const url = `${YF_CHART_BASE_URL}${encodeURIComponent(symbol)}`;

  let response;
  try {
    response = await axios.get(url, { params, headers: REQUEST_HEADERS, timeout });
  } catch (error) {
    if (error.response?.status === 429) {
      await sleep(retryDelayMs);
      response = await axios.get(url, { params, headers: REQUEST_HEADERS, timeout });
    } else {
      throw error;
    }
  }

  const result = response.data?.chart?.result?.[0];
  if (!result || !result.meta) {
    throw new Error(`Missing chart result for ${symbol}`);
  }

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const candles = [];

  for (let i = 0; i < timestamps.length; i += 1) {
    const close = quote.close?.[i];
    if (close === null || close === undefined) continue;
    candles.push({
      date: new Date(timestamps[i] * 1000),
      open: quote.open?.[i] ?? close,
      high: quote.high?.[i] ?? close,
      low: quote.low?.[i] ?? close,
      close,
      volume: quote.volume?.[i] ?? 0,
    });
  }

  return {
    meta: result.meta,
    candles,
  };
}

module.exports = {
  fetchYahooChart,
  sleep,
};

