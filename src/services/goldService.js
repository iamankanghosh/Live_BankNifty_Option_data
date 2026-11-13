const axios = require('axios');
const { fetchYahooChart } = require('./yahooClient');

const GROWW_GOLD_RATES_URL = 'https://groww.in/gold-rates';

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Accept: 'text/html,application/json',
};

const round2 = (num) => Number(Number(num).toFixed(2));

/**
 * Fetches latest market quote metadata for a Yahoo Finance symbol via the v8 chart endpoint.
 */
async function fetchYahooChartQuote(symbol) {
  const { meta } = await fetchYahooChart(symbol, { timeout: 8000 });
  if (meta.regularMarketPrice === undefined) {
    throw new Error(`Missing market price in Yahoo chart response for ${symbol}`);
  }

  return {
    symbol: meta.symbol || symbol,
    price: Number(meta.regularMarketPrice),
    previousClose:
      meta.chartPreviousClose !== undefined ? Number(meta.chartPreviousClose) : null,
    currency: meta.currency || 'INR',
  };
}

/**
 * Extracts Groww's Next.js pageProps physicalGoldRate table from https://groww.in/gold-rates.
 */
function parseGrowwGoldRatesHtml(html, city = 'india') {
  const markerIndex = html.indexOf('__NEXT_DATA__');
  if (markerIndex === -1) {
    throw new Error('Could not find __NEXT_DATA__ in Groww gold rates page');
  }

  const jsonStart = html.indexOf('>', markerIndex) + 1;
  const jsonEnd = html.indexOf('</script>', jsonStart);
  if (jsonStart <= 0 || jsonEnd === -1) {
    throw new Error('Malformed __NEXT_DATA__ script tag in Groww gold rates page');
  }

  const nextData = JSON.parse(html.slice(jsonStart, jsonEnd));
  const physicalGoldRate = nextData?.props?.pageProps?.goldRateData?.physicalGoldRate;
  if (!physicalGoldRate || typeof physicalGoldRate !== 'object') {
    throw new Error('Missing physicalGoldRate in Groww gold rates payload');
  }

  const normalizedCity = String(city || 'india').trim().toLowerCase();
  const entry = physicalGoldRate[normalizedCity] || physicalGoldRate.india;
  if (!entry || !entry.price) {
    throw new Error(`Gold rate entry not found for location "${normalizedCity}"`);
  }

  const gold24kPerGram = Number(entry.price.TWENTY_FOUR);
  const gold22kPerGram = Number(entry.price.TWENTY_TWO);
  if (!Number.isFinite(gold24kPerGram) || !Number.isFinite(gold22kPerGram)) {
    throw new Error('Invalid 24K/22K price values in Groww gold rates payload');
  }

  return {
    location: entry.priceLocation || 'India',
    rateDate: entry.date || null,
    gold24kPerGram: round2(gold24kPerGram),
    gold24kPer10Grams: round2(gold24kPerGram * 10),
    gold22kPerGram: round2(gold22kPerGram),
    gold22kPer10Grams: round2(gold22kPerGram * 10),
    changePerc24k:
      entry.percentageChange?.TWENTY_FOUR !== undefined
        ? round2(entry.percentageChange.TWENTY_FOUR)
        : null,
    changePerc22k:
      entry.percentageChange?.TWENTY_TWO !== undefined
        ? round2(entry.percentageChange.TWENTY_TWO)
        : null,
  };
}

/**
 * Fetches live Indian 24K & 22K physical gold rates from Groww.
 */
async function fetchIndianGoldRates(city = 'india') {
  const response = await axios.get(GROWW_GOLD_RATES_URL, {
    headers: REQUEST_HEADERS,
    timeout: 10000,
  });
  return parseGrowwGoldRatesHtml(String(response.data), city);
}

/**
 * Returns Indian 24K & 22K gold prices in INR along with SBI Gold ETF and ICICI Gold ETF prices.
 */
async function fetchGoldAndEtfPrices(deps = {}) {
  const city = deps.city || 'india';
  const getQuote = deps.fetchYahooChartQuote || fetchYahooChartQuote;
  const getIndianGold = deps.fetchIndianGoldRates || (() => fetchIndianGoldRates(city));

  const [goldRates, sbiGoldEtf, iciciGoldEtf] = await Promise.all([
    getIndianGold(),
    getQuote('SETFGOLD.NS'),
    getQuote('GOLDIETF.NS'),
  ]);

  return {
    currency: 'INR',
    unit: '10 grams (perGram also included)',
    location: goldRates.location,
    rateDate: goldRates.rateDate,
    gold24kPrice: goldRates.gold24kPer10Grams,
    gold22kPrice: goldRates.gold22kPer10Grams,
    gold24kPerGram: goldRates.gold24kPerGram,
    gold22kPerGram: goldRates.gold22kPerGram,
    sbiGoldEtfPrice: round2(sbiGoldEtf.price),
    iciciGoldEtfPrice: round2(iciciGoldEtf.price),
    details: {
      gold24k: {
        perGram: goldRates.gold24kPerGram,
        per10Grams: goldRates.gold24kPer10Grams,
        changePerc: goldRates.changePerc24k,
      },
      gold22k: {
        perGram: goldRates.gold22kPerGram,
        per10Grams: goldRates.gold22kPer10Grams,
        changePerc: goldRates.changePerc22k,
      },
      sbiGoldEtf,
      iciciGoldEtf,
      source: 'groww.in/gold-rates & Yahoo Finance NSE ETFs',
    },
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  fetchYahooChartQuote,
  parseGrowwGoldRatesHtml,
  fetchIndianGoldRates,
  fetchGoldAndEtfPrices,
};
