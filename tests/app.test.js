const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const createApp = require('../src/app');
const {
  aggregateMonthly,
  getMonthlyDataForTickers,
  renderSeasonalHtml,
} = require('../src/services/seasonalService');
const marketService = require('../src/services/marketService');
const { fetchGoldAndEtfPrices, parseGrowwGoldRatesHtml } = require('../src/services/goldService');
const config = require('../src/config/env');

async function startTestServer(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('aggregateMonthly computes monthly closes, pchange, and descending sort', () => {
  const daily = [
    { date: '2024-01-05T00:00:00Z', open: 100, high: 105, low: 98, close: 100, volume: 10 },
    { date: '2024-01-25T00:00:00Z', open: 101, high: 112, low: 99, close: 110, volume: 20 },
    { date: '2024-02-15T00:00:00Z', open: 110, high: 125, low: 108, close: 121, volume: 30 },
  ];

  const monthly = aggregateMonthly(daily, 'TCS.NS');
  assert.equal(monthly.length, 2);
  assert.equal(monthly[0].date, '2024-02-15');
  assert.equal(monthly[0].close, 121);
  assert.equal(monthly[0].pchange, 10);
  assert.equal(monthly[1].date, '2024-01-25');
  assert.equal(monthly[1].close, 110);
  assert.equal(monthly[1].pchange, null);
});

test('renderSeasonalHtml renders positive/negative tiles and escapes HTML', () => {
  const html = renderSeasonalHtml([
    {
      ticker: 'TCS.NS',
      name: 'Tata <Consultancy>',
      marketCapInCr: '100 Cr',
      industry: 'IT',
      earningdate: '2025-01-09',
      result: [
        { date: '2024-12-31', pchange: 5.5 },
        { date: '2024-11-30', pchange: -2.1 },
      ],
    },
  ]);

  assert.match(html, /Tata &lt;Consultancy&gt;/);
  assert.match(html, /class="result-name positive"/);
  assert.match(html, /class="result-name negative"/);
});

test('Merged Express app routes handle both Live BankNifty and Seasonal endpoints distinctly', async () => {
  const mockMarketService = {
    fetchMoneycontrolIndex: async (id) => ({ indices: { lastprice: id === 23 ? '51000' : '24500' } }),
    fetchOptionStrikeData: async (type) =>
      type === 'call'
        ? { callKey: '24650.0', ltp: '120.5', pChange: '12' }
        : { putKey: '24650.0', ltp: '95.0', pChange: '-8' },
    updateStrikeConfig: async (key, value) => {
      if (key === 'unknown') {
        throw new marketService.HttpError(404, 'Key not found');
      }
      return { [key]: value };
    },
    readStrikeConfig: async () => ({ callKey: '24650.0', putKey: '24650.0', expiryDate: '07-11-2024' }),
    fetchNseSvg: async () => Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    readStrikeHistory: async () => [{ date: '29/10/2024', callPriceKey: '24350.0' }],
    readEarningsData: async (limit) => [{ stockName: 'TCS', limitUsed: limit }],
    refreshEarningsData: async () => 42,
  };

  const mockSeasonalService = {
    getStockData: async () => [
      {
        ticker: '^NSEI',
        name: 'NIFTY 50',
        marketCapInCr: 'Unknown',
        industry: 'NIFTY 50',
        earningdate: 'Unknown',
        result: [{ date: '2024-12-31', pchange: 1.25 }],
      },
    ],
    renderSeasonalHtml,
    fetchData: async () => ({ skipped: false, count: 1 }),
  };

  const mockGoldService = {
    fetchGoldAndEtfPrices: async () => ({
      currency: 'INR',
      gold24kPrice: 118574.8,
      gold22kPrice: 108693.57,
      gold24kPerGram: 11857.48,
      gold22kPerGram: 10869.36,
      sbiGoldEtfPrice: 120.02,
      iciciGoldEtfPrice: 116.55,
    }),
  };

  const app = createApp({
    marketService: mockMarketService,
    seasonalService: mockSeasonalService,
    goldService: mockGoldService,
  });
  const srv = await startTestServer(app);

  try {
    // Root & Health
    const rootRes = await fetch(`${srv.baseUrl}/`);
    assert.equal(rootRes.status, 200);
    const rootJson = await rootRes.json();
    assert.equal(rootJson.msg, 'msg from server');

    // Moneycontrol proxy routes
    const bnRes = await fetch(`${srv.baseUrl}/banknifty`);
    assert.equal((await bnRes.json()).indices.lastprice, '51000');

    const n50Res = await fetch(`${srv.baseUrl}/nifty50`);
    assert.equal((await n50Res.json()).indices.lastprice, '24500');

    // Option chain call/put routes
    const callRes = await fetch(`${srv.baseUrl}/upstox/call/fetchData`);
    assert.deepEqual(await callRes.json(), { callKey: '24650.0', ltp: '120.5', pChange: '12' });

    const putRes = await fetch(`${srv.baseUrl}/upstox/put/fetchData`);
    assert.deepEqual(await putRes.json(), { putKey: '24650.0', ltp: '95.0', pChange: '-8' });

    // Form-urlencoded updateData
    const updateRes = await fetch(`${srv.baseUrl}/updateData/callKey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'value=24700',
    });
    assert.equal(updateRes.status, 200);
    assert.equal(await updateRes.text(), 'Data updated successfully');

    const missingKeyRes = await fetch(`${srv.baseUrl}/updateData/unknown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'value=123',
    });
    assert.equal(missingKeyRes.status, 404);

    // SVG route
    const svgRes = await fetch(`${srv.baseUrl}/fetchSVG`);
    assert.equal(svgRes.status, 200);
    assert.match(svgRes.headers.get('content-type'), /image\/svg\+xml/);

    // Case-sensitive distinction: /getData (JSON strike log) vs /getdata (HTML seasonal view)
    const strikeJsonRes = await fetch(`${srv.baseUrl}/getData`);
    assert.equal(strikeJsonRes.status, 200);
    assert.match(strikeJsonRes.headers.get('content-type'), /application\/json/);
    const strikeJson = await strikeJsonRes.json();
    assert.equal(strikeJson[0].date, '29/10/2024');

    const seasonalHtmlRes = await fetch(`${srv.baseUrl}/getdata`);
    assert.equal(seasonalHtmlRes.status, 200);
    assert.match(seasonalHtmlRes.headers.get('content-type'), /text\/html/);
    const seasonalHtml = await seasonalHtmlRes.text();
    assert.match(seasonalHtml, /Ticker: \^NSEI/);

    // New JSON seasonal API
    const seasonalJsonRes = await fetch(`${srv.baseUrl}/api/seasonal`);
    assert.equal(seasonalJsonRes.status, 200);
    const seasonalJson = await seasonalJsonRes.json();
    assert.equal(seasonalJson[0].ticker, '^NSEI');

    // Earnings data
    const resultRes = await fetch(`${srv.baseUrl}/resultData`);
    assert.equal(resultRes.status, 200);
    const resultJson = await resultRes.json();
    assert.equal(resultJson[0].stockName, 'TCS');

    // Gold 24k, 22k, SBI ETF & ICICI ETF endpoint
    const goldRes = await fetch(`${srv.baseUrl}/gold`);
    assert.equal(goldRes.status, 200);
    const goldJson = await goldRes.json();
    assert.equal(goldJson.gold24kPrice, 118574.8);
    assert.equal(goldJson.gold22kPrice, 108693.57);
    assert.equal(goldJson.sbiGoldEtfPrice, 120.02);
    assert.equal(goldJson.iciciGoldEtfPrice, 116.55);

    const apiGoldRes = await fetch(`${srv.baseUrl}/api/gold`);
    assert.equal(apiGoldRes.status, 200);
  } finally {
    await srv.close();
  }
});

test('fetchGoldAndEtfPrices maps Indian 24k/22k Groww gold rates and SBI/ICICI ETF quotes', async () => {
  const sampleHtml = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        goldRateData: {
          physicalGoldRate: {
            india: {
              date: '2026-11-12',
              priceLocation: 'India',
              price: { TWENTY_FOUR: 13980, TWENTY_TWO: 12815 },
              percentageChange: { TWENTY_FOUR: -1.54, TWENTY_TWO: -1.54 },
            },
            delhi: {
              date: '2026-11-12',
              priceLocation: 'Delhi',
              price: { TWENTY_FOUR: 13995, TWENTY_TWO: 12829 },
              percentageChange: { TWENTY_FOUR: -1.53, TWENTY_TWO: -1.54 },
            },
          },
        },
      },
    },
  })}</script>`;

  const parsedDelhi = parseGrowwGoldRatesHtml(sampleHtml, 'delhi');
  assert.equal(parsedDelhi.location, 'Delhi');
  assert.equal(parsedDelhi.gold24kPerGram, 13995);
  assert.equal(parsedDelhi.gold24kPer10Grams, 139950);

  const result = await fetchGoldAndEtfPrices({
    fetchIndianGoldRates: async () => parseGrowwGoldRatesHtml(sampleHtml, 'india'),
    fetchYahooChartQuote: async (symbol) => ({
      symbol,
      price: symbol === 'SETFGOLD.NS' ? 120.02 : 116.54,
      previousClose: 119.0,
      currency: 'INR',
    }),
  });

  assert.equal(result.currency, 'INR');
  assert.equal(result.location, 'India');
  assert.equal(result.gold24kPerGram, 13980);
  assert.equal(result.gold24kPrice, 139800);
  assert.equal(result.gold22kPerGram, 12815);
  assert.equal(result.gold22kPrice, 128150);
  assert.equal(result.sbiGoldEtfPrice, 120.02);
  assert.equal(result.iciciGoldEtfPrice, 116.54);
  assert.equal(result.details.sbiGoldEtf.symbol, 'SETFGOLD.NS');
  assert.equal(result.details.iciciGoldEtf.symbol, 'GOLDIETF.NS');
});

test('getMonthlyDataForTickers aggregates chart candles cleanly without crumb errors', async () => {
  const rows = await getMonthlyDataForTickers(
    [{ ticker_id: 'RELIANCE.NS', industry: 'Oil Gas & Consumable Fuels' }],
    {
      delayMs: 0,
      chartFetcher: async () => ({
        meta: { longName: 'Reliance Industries Limited' },
        candles: [
          { date: new Date('2024-01-15T00:00:00Z'), open: 100, high: 110, low: 95, close: 100, volume: 1000 },
          { date: new Date('2024-02-15T00:00:00Z'), open: 100, high: 120, low: 98, close: 115, volume: 1200 },
        ],
      }),
    }
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].ticker, 'RELIANCE.NS');
  assert.equal(rows[0].name, 'Reliance Industries Limited');
  assert.equal(rows[0].result[0].pchange, 15);
  assert.equal(rows[0].result[1].pchange, null);
});

test('Real data files (data.json, resultData.json, strikeConfig.json) read cleanly and updateStrikeConfig formats properly', async () => {
  const history = await marketService.readStrikeHistory();
  assert.ok(Array.isArray(history) && history.length > 0);
  // Sorted descending by DD/MM/YYYY
  assert.equal(history[0].date, '29/10/2024');

  const earnings = await marketService.readEarningsData(10);
  assert.equal(earnings.length, 10);
  assert.ok(earnings[0].stockName);

  const original = await fs.readFile(config.STRIKE_CONFIG_PATH, 'utf8');
  try {
    const updatedCall = await marketService.updateStrikeConfig('callKey', '25000');
    assert.equal(updatedCall.callKey, '25000.0');

    const updatedExpiry = await marketService.updateStrikeConfig('expiryDate', '2026-11-19');
    assert.equal(updatedExpiry.expiryDate, '19-11-2026');

    await assert.rejects(
      () => marketService.updateStrikeConfig('expiryDate', 'invalid-date'),
      (err) => err.status === 400
    );
  } finally {
    await fs.writeFile(config.STRIKE_CONFIG_PATH, original, 'utf8');
  }
});

