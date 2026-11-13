# stock_backend

Unified Node.js / Express backend merging:
- **Live BankNifty / Nifty Option Data** (`Live_BankNifty_Option_data-main`)
- **Seasonal Stock Analysis** (`seasonal_stock_analysis-master`)
- **Gold & Gold ETF Rates** (`24K`, `22K`, SBI Gold ETF, ICICI Gold ETF)

> `Live_BankNifty_Option_data-main/Nifty_BankNIfty_extnsion` remains unchanged and is fully supported by all preserved routes.

---

## Setup & Running

```bash
cd stock_backend
npm install
npm start
```

Development mode (auto-reload with `nodemon`):

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Default base URL: `http://localhost:4500`

---

## Environment Variables

See [`.env.example`](./.env.example):

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4500` | HTTP server port |
| `MONGO_URI` | *(Atlas URI)* | MongoDB connection string for seasonal stock data |
| `MONGO_DB_NAME` | `stock_data_lastyear` | MongoDB database name |
| `MONGO_COLLECTION_NAME` | `monthly_data` | MongoDB collection name |
| `ENABLE_EARNINGS_SYNC` | `true` | Sync Moneycontrol earnings calendar on startup and interval |
| `ENABLE_SEASONAL_SYNC` | `true` | Sync 500 NSE tickers from Yahoo Finance into MongoDB on startup and interval |
| `SEASONAL_SYNC_INTERVAL_MS` | `7200000` | Seasonal sync interval (default: 120 minutes) |
| `EARNINGS_SYNC_INTERVAL_MS` | `86400000` | Earnings sync interval (default: 24 hours) |
| `ENABLE_STRIKE_ALGO` | `false` | Enable 09:30 IST Upstox strike snapshot job |
| `KEEP_ALIVE_URL` | `""` | Optional URL pinged every 30s when set |

---

## API Endpoints & Responses

> **Note on Case Sensitivity:** Express `case sensitive routing` is enabled so `GET /getData` (JSON strike history) and `GET /getdata` (HTML seasonal view) remain distinct.

---

### 1. Health & Status

#### `GET /`
Server status check.

**Response `200 OK` (`application/json`)**
```json
{
  "msg": "msg from server",
  "status": "running",
  "services": [
    "market-options",
    "seasonal-stocks"
  ]
}
```

#### `GET /health`
Uptime and health check.

**Response `200 OK` (`application/json`)**
```json
{
  "status": "ok",
  "uptime": 12.3456789
}
```

---

### 2. Live Market Indices & Option Chain

#### `GET /banknifty`
Fetches live Bank Nifty index data from Moneycontrol (`ind_id=23`).

**Response `200 OK` (`application/json`)**
```json
{
  "indices": {
    "lastprice": "51,234.50",
    "change": "210.35",
    "percentchange": "0.41",
    "high": "51,420.00",
    "low": "50,980.10"
  }
}
```
*(Proxies the full Moneycontrol `indices` payload.)*

**Error `500`**
```json
{
  "error": "Failed to fetch data from Moneycontrol API"
}
```

#### `GET /nifty50`
Fetches live Nifty 50 index data from Moneycontrol (`ind_id=9`).

**Response `200 OK` (`application/json`)**
```json
{
  "indices": {
    "lastprice": "24,650.25",
    "change": "85.10",
    "percentchange": "0.35",
    "high": "24,710.00",
    "low": "24,520.40"
  }
}
```

**Error `500`**
```json
{
  "error": "Failed to fetch data from Moneycontrol API nifty50"
}
```

#### `GET /upstox/call/fetchData`
Fetches live Nifty Call option LTP and day % change from Groww for the configured `callKey` in `data/strikeConfig.json`.

**Response `200 OK` (`application/json`)**
```json
{
  "callKey": "24650.0",
  "ltp": "120.5",
  "pChange": "12"
}
```

**Errors `400` / `404` / `502` / `500`**
```json
{
  "error": "Option strike 24650.0 not found in option chain"
}
```

#### `GET /upstox/put/fetchData`
Fetches live Nifty Put option LTP and day % change from Groww for the configured `putKey` in `data/strikeConfig.json`.

**Response `200 OK` (`application/json`)**
```json
{
  "putKey": "24650.0",
  "ltp": "95.0",
  "pChange": "-8"
}
```

---

### 3. Strike Configuration & History

#### `GET /strikeConfig`
Returns the current strike & expiry configuration from `data/strikeConfig.json`.

**Response `200 OK` (`application/json`)**
```json
{
  "expiryDate": "07-11-2024",
  "upstoxurl": "https://service.upstox.com/option-analytics-tool/open/v1/strategy-chains?assetKey=NSE_INDEX%7CNifty+50&strategyChainType=PC_CHAIN&expiry=",
  "callKey": "24650.0",
  "putKey": "24650.0"
}
```

#### `POST /updateData/:key`
Updates a key in `data/strikeConfig.json`. Supports `application/x-www-form-urlencoded` and `application/json`.

- **Path param `:key`**: `callKey`, `putKey`, `expiryDate`, or `upstoxurl`
- **Body**: `{ "value": "24700" }` (for `expiryDate`, send `YYYY-MM-DD`, which is stored as `DD-MM-YYYY`)

**Response `200 OK` (`text/plain`)**
```text
Data updated successfully
```

**Errors (`text/plain`)**
- `400`: `Value is required`, `expiryDate must be in YYYY-MM-DD format`, or `<key> must be a valid number`
- `404`: `Key not found`

#### `GET /getData`
*(CamelCase)* Returns recorded strike snapshots from `data/data.json`, sorted descending by `date` (`DD/MM/YYYY`).

**Response `200 OK` (`application/json`)**
```json
[
  {
    "date": "29/10/2024",
    "callPriceKey": "24350.0",
    "callvalue": 114.6,
    "putPriceKey": "24350.0",
    "putvalue": 100.2
  },
  {
    "date": "28/10/2024",
    "callPriceKey": 24350,
    "callvalue": 114.6,
    "putPriceKey": 24350,
    "putvalue": 100.2
  }
]
```

---

### 4. NSE Intraday Chart & Earnings Calendar

#### `GET /fetchSVG`
Proxies an NSE intraday SVG sparkline image.

- **Query param `symbol`** *(optional, defaults to `RELIANCE`)*: e.g. `/fetchSVG?symbol=TCS`

**Response `200 OK` (`image/svg+xml`)**
Raw SVG binary/XML content.

**Error `500`**
```json
{
  "error": "Error fetching SVG"
}
```

#### `GET /resultData`
Returns upcoming/recent earnings calendar entries from `data/resultData.json` sorted by market cap.

- **Query param `limit`** *(optional, default `50`, clamped to `1..500`)*: e.g. `/resultData?limit=10`

**Response `200 OK` (`application/json`)**
```json
[
  {
    "date": "9 Jan",
    "stockName": "Tata Consultancy Services",
    "scId": "TCS",
    "stockUrl": "https://www.moneycontrol.com/india/stockpricequote/computers-software/tataconsultancyservices/TCS",
    "resultType": "Q3 FY25-26",
    "ltp": "4099.90",
    "change": "-1.82",
    "time": "Time Not Available",
    "seeFinancial": "https://www.moneycontrol.com/india/stockpricequote/computers-software/tataconsultancyservices/TCS#financials",
    "stockShortName": "TCS",
    "marketCap": 1483379.7,
    "exchange": "N"
  }
]
```

#### `POST /api/earnings/refresh`
Manually triggers a Moneycontrol earnings sync (`-30` to `+30` days) and updates `data/resultData.json`.

**Response `200 OK` (`application/json`)**
```json
{
  "status": "ok",
  "count": 1520
}
```

---

### 5. Gold & Gold ETF Prices (INR)

#### `GET /gold` *(alias: `GET /api/gold`)*
Returns live Indian 24K and 22K physical gold prices in INR (sourced from `groww.in/gold-rates`, per 10 grams and per gram) along with live NSE prices for SBI Gold ETF (`SETFGOLD.NS`) and ICICI Prudential Gold ETF (`GOLDIETF.NS`).

- **Query param `city`** *(optional, defaults to `india`)*: e.g. `/gold?city=delhi`, `/gold?city=mumbai`, `/gold?city=kolkata`

**Response `200 OK` (`application/json`)**
```json
{
  "currency": "INR",
  "unit": "10 grams (perGram also included)",
  "location": "India",
  "rateDate": "2026-11-12",
  "gold24kPrice": 139800,
  "gold22kPrice": 128150,
  "gold24kPerGram": 13980,
  "gold22kPerGram": 12815,
  "sbiGoldEtfPrice": 120.02,
  "iciciGoldEtfPrice": 116.54,
  "details": {
    "gold24k": {
      "perGram": 13980,
      "per10Grams": 139800,
      "changePerc": -1.54
    },
    "gold22k": {
      "perGram": 12815,
      "per10Grams": 128150,
      "changePerc": -1.54
    },
    "sbiGoldEtf": {
      "symbol": "SETFGOLD.NS",
      "price": 120.02,
      "previousClose": 120.02,
      "currency": "INR"
    },
    "iciciGoldEtf": {
      "symbol": "GOLDIETF.NS",
      "price": 116.54,
      "previousClose": 119.43,
      "currency": "INR"
    },
    "source": "groww.in/gold-rates & Yahoo Finance NSE ETFs"
  },
  "updatedAt": "2026-11-12T09:30:00.000Z"
}
```

**Error `500`**
```json
{
  "error": "Failed to fetch gold and ETF prices"
}
```

---

### 6. Seasonal Stock Analysis

#### `GET /getdata` *(alias: `GET /seasonal/getdata`)*
*(Lowercase)* Queries MongoDB for the last 48 months of monthly stock performance and renders the dark-mode HTML heatmap grid.

**Response `200 OK` (`text/html`)**
HTML document displaying each stock header (`ticker`, `name`, `marketCapInCr`, `industry`, `earningdate`) and green/red monthly `% change` tiles (12 per row).

**Error `500` (`text/plain`)**
```text
Internal Server Error
```

#### `GET /api/seasonal`
JSON version of the seasonal stock dataset stored in MongoDB (last 48 months per ticker).

**Response `200 OK` (`application/json`)**
```json
[
  {
    "ticker": "^NSEI",
    "name": "NIFTY 50",
    "industry": "NIFTY 50",
    "earningdate": "Unknown",
    "marketCapInCr": "Unknown",
    "result": [
      {
        "date": "2026-11-12",
        "ticker": "^NSEI",
        "close": 24650.25,
        "open": 24500.0,
        "high": 24710.0,
        "low": 24480.0,
        "volume": 0,
        "pchange": 9.53
      }
    ]
  }
]
```

#### `POST /api/seasonal/sync`
Manually triggers a Yahoo Finance → MongoDB sync across all 500 tickers in `src/config/tickers.js`.

**Response `200 OK` (`application/json`)**
```json
{
  "status": "ok",
  "skipped": false,
  "count": 500
}
```
If a sync is already running:
```json
{
  "status": "ok",
  "skipped": true
}
```
