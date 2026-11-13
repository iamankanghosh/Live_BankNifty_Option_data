const fs = require('fs/promises');
const axios = require('axios');
const CircularJSON = require('circular-json');
const config = require('../config/env');

const MONEYCONTROL_INDEX_URL =
  'https://appfeeds.moneycontrol.com/jsonapi/market/indices&format=json&t_device=iphone&t_app=MC&t_version=48&ind_id=';
const GROWW_NIFTY_OPTION_CHAIN_URL =
  'https://groww.in/v1/api/option_chain_service/v1/option_chain/nifty';
const NSE_SVG_BASE_URL = 'https://nsearchives.nseindia.com/today/';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readJsonFile(filePath, fallback = []) {
  const raw = await fs.readFile(filePath, 'utf8');
  return raw ? JSON.parse(raw) : fallback;
}

async function writeJsonFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Fetches live index data (e.g., BankNifty = 23, Nifty 50 = 9) from Moneycontrol.
 */
async function fetchMoneycontrolIndex(indexId) {
  const response = await axios.get(`${MONEYCONTROL_INDEX_URL}${indexId}`);
  return CircularJSON.parse(CircularJSON.stringify(response.data));
}

async function readStrikeConfig() {
  return readJsonFile(config.STRIKE_CONFIG_PATH, {});
}

/**
 * Fetches live option LTP and day change percentage for configured callKey or putKey.
 */
async function fetchOptionStrikeData(optionType) {
  const isCall = optionType === 'call';
  const keyName = isCall ? 'callKey' : 'putKey';
  const chainField = isCall ? 'callOption' : 'putOption';

  const strikeConfig = await readStrikeConfig();
  const strikeKey = strikeConfig[keyName];
  const targetStrike = Number(strikeKey) * 100;

  if (!Number.isFinite(targetStrike)) {
    throw new HttpError(400, `Invalid configured ${keyName}`);
  }

  const response = await axios.get(GROWW_NIFTY_OPTION_CHAIN_URL);
  const optionChains = response.data?.optionChains;
  if (!Array.isArray(optionChains)) {
    throw new HttpError(502, 'Invalid option chain response from upstream');
  }

  const matched = optionChains.find((option) => option.strikePrice === targetStrike);
  const optionData = matched?.[chainField];
  if (!optionData || optionData.ltp === undefined || optionData.dayChangePerc === undefined) {
    throw new HttpError(404, `Option strike ${strikeKey} not found in option chain`);
  }

  return {
    [keyName]: strikeKey,
    ltp: Number(optionData.ltp).toFixed(1),
    pChange: Number(optionData.dayChangePerc).toFixed(0),
  };
}

/**
 * Updates a strike configuration field (expiryDate, callKey, putKey, upstoxurl).
 */
async function updateStrikeConfig(key, rawValue) {
  const data = await readStrikeConfig();
  if (!Object.prototype.hasOwnProperty.call(data, key)) {
    throw new HttpError(404, 'Key not found');
  }

  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
    throw new HttpError(400, 'Value is required');
  }

  let formattedValue = String(rawValue).trim();

  if (key === 'expiryDate') {
    const parts = formattedValue.split('-');
    if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) {
      throw new HttpError(400, 'expiryDate must be in YYYY-MM-DD format');
    }
    formattedValue = `${parts[2]}-${parts[1]}-${parts[0]}`;
  } else if (key === 'callKey' || key === 'putKey') {
    const parsed = parseInt(formattedValue, 10);
    if (Number.isNaN(parsed)) {
      throw new HttpError(400, `${key} must be a valid number`);
    }
    formattedValue = parsed.toFixed(1);
  }

  data[key] = formattedValue;
  await writeJsonFile(config.STRIKE_CONFIG_PATH, data);
  return data;
}

/**
 * Proxies NSE intraday SVG chart (defaults to RELIANCEEQN.svg).
 */
async function fetchNseSvg(symbol = 'RELIANCE') {
  const safeSymbol = String(symbol).replace(/[^A-Za-z0-9&-]/g, '').toUpperCase() || 'RELIANCE';
  const response = await axios.get(`${NSE_SVG_BASE_URL}${safeSymbol}EQN.svg`, {
    responseType: 'arraybuffer',
    headers: {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
    },
  });
  return response.data;
}

function parseDdMmYyyy(dateStr) {
  const [day, month, year] = String(dateStr).split('/');
  return new Date(`${year}-${month}-${day}`).getTime();
}

/**
 * Reads recorded strike entries sorted descending by date.
 */
async function readStrikeHistory() {
  const jsonArray = await readJsonFile(config.STRIKE_HISTORY_PATH, []);
  return jsonArray.sort((a, b) => parseDdMmYyyy(b.date) - parseDdMmYyyy(a.date));
}

/**
 * Reads top N upcoming/recent earnings results sorted by market cap.
 */
async function readEarningsData(limit = 50) {
  const jsonArray = await readJsonFile(config.EARNINGS_DATA_PATH, []);
  return jsonArray.slice(0, limit);
}

/**
 * Fetches earnings calendar (+/- 30 days) from Moneycontrol and persists to resultData.json.
 */
async function refreshEarningsData() {
  const currentDate = new Date();
  const startDate = new Date(currentDate);
  startDate.setDate(currentDate.getDate() - 30);
  const endDate = new Date(currentDate);
  endDate.setDate(currentDate.getDate() + 30);

  const startDateString = startDate.toISOString().split('T')[0];
  const endDateString = endDate.toISOString().split('T')[0];

  const requests = [];
  for (let page = 1; page <= 100; page += 1) {
    const url = `https://api.moneycontrol.com/mcapi/v1/earnings/get-earnings-data?indexId=All&page=${page}&startDate=${startDateString}&endDate=${endDateString}&sector=&limit=20&sortBy=marketcap&search=&seq=desc`;
    requests.push(axios.get(url));
  }

  const settled = await Promise.allSettled(requests);
  const resultData = [];
  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      const list = outcome.value?.data?.data?.list;
      if (Array.isArray(list) && list.length > 0) {
        resultData.push(...list);
      }
    }
  }

  if (resultData.length === 0) {
    console.warn('Earnings sync returned 0 records; keeping existing resultData.json');
    return 0;
  }

  resultData.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
  await writeJsonFile(config.EARNINGS_DATA_PATH, resultData);
  console.log(`Earnings data synced (${resultData.length} records)`);
  return resultData.length;
}

function isIst0930(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      if (part.type === 'hour' || part.type === 'minute') {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  return parts.hour === '09' && parts.minute === '30';
}

/**
 * Captures call/put strikes near LTP 100 from Upstox strategy chain at 09:30 IST.
 */
async function runStrikeAlgo({ force = false } = {}) {
  if (!force && !isIst0930()) {
    return null;
  }

  const { expiryDate, upstoxurl } = await readStrikeConfig();
  const response = await axios.get(`${upstoxurl}${expiryDate}`);
  const upstoxdata = response.data?.data?.strategyChainData?.strikeMap;
  if (!upstoxdata || typeof upstoxdata !== 'object') {
    throw new Error('Invalid Upstox strategy chain response');
  }

  const keys = Object.keys(upstoxdata);
  let callPriceKey = null;
  let callvalue = null;
  let putPriceKey = null;
  let putvalue = null;

  keys.forEach((key, index) => {
    const prevKey = index > 0 ? keys[index - 1] : null;
    const callLtp = upstoxdata[key]?.callOptionData?.marketData?.ltp;
    const putLtp = upstoxdata[key]?.putOptionData?.marketData?.ltp;

    if (callLtp !== undefined && callLtp < 100 && callPriceKey === null && prevKey) {
      callPriceKey = prevKey;
      callvalue = upstoxdata[prevKey]?.callOptionData?.marketData?.ltp ?? null;
    }
    if (putLtp !== undefined && putLtp > 100 && putPriceKey === null) {
      putPriceKey = key;
      putvalue = putLtp;
    }
  });

  const newEntry = {
    date: new Date().toLocaleDateString('en-GB'),
    callPriceKey: parseInt(callPriceKey, 10),
    callvalue,
    putPriceKey: parseInt(putPriceKey, 10),
    putvalue,
  };

  const jsonArray = await readJsonFile(config.STRIKE_HISTORY_PATH, []);
  jsonArray.push(newEntry);
  await writeJsonFile(config.STRIKE_HISTORY_PATH, jsonArray);
  console.log('Strike algo snapshot recorded:', newEntry);
  return newEntry;
}

module.exports = {
  HttpError,
  fetchMoneycontrolIndex,
  readStrikeConfig,
  fetchOptionStrikeData,
  updateStrikeConfig,
  fetchNseSvg,
  readStrikeHistory,
  readEarningsData,
  refreshEarningsData,
  runStrikeAlgo,
};

