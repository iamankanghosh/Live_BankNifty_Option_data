document.addEventListener('DOMContentLoaded', function () {
  const API_BASE_URL = 'http://localhost:4500';
  const FALLBACK_NIFTY_URL = 'https://live-banknifty-option-data.onrender.com/nifty50';

  function formatInr(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return 'NA';
    }
    return `₹${Number(value).toLocaleString('en-IN')}`;
  }

  function updateNiftyChart(data) {
    const indices = data && data.indices;
    if (!indices) {
      throw new Error('Missing indices payload');
    }

    const dataPrice = indices.lastprice;
    const dataChange = indices.change;
    const dataPercentChange = indices.percentchange;
    const dataHigh = indices.high;
    const dataLow = indices.low;

    document.getElementById('N_LASTPRICE').innerText = dataPrice;
    document.getElementById('N_CHANGE').innerText = dataChange;
    document.getElementById('N_PERCENTCHANGE').innerText = dataPercentChange;
    document.getElementById('N_HIGH').innerText = dataHigh;
    document.getElementById('N_LOW').innerText = dataLow;

    const numPrice = parseFloat(String(dataPrice).replace(/,/g, ''));
    const numLow = parseFloat(String(dataLow).replace(/,/g, ''));
    const numHigh = parseFloat(String(dataHigh).replace(/,/g, ''));
    const range = numHigh - numLow;
    const percentage = range > 0 ? Math.max(0, Math.min(100, ((numPrice - numLow) / range) * 100)) : 50;

    const priceChart = document.getElementById('N_PRICE_CHART');
    priceChart.style.width = `${percentage}%`;

    const previousDot = document.querySelector('.n-current-price-dot');
    if (previousDot) {
      previousDot.remove();
    }

    const currentPriceDot = document.createElement('div');
    currentPriceDot.className = 'n-current-price-dot';
    currentPriceDot.style.left = `${percentage}%`;
    priceChart.appendChild(currentPriceDot);
  }

  function fetchNiftyData() {
    fetch(`${API_BASE_URL}/nifty50`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .catch(() =>
        fetch(FALLBACK_NIFTY_URL).then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
      )
      .then(updateNiftyChart)
      .catch((error) => {
        console.error('Nifty 50 fetch error:', error);
        ['N_LASTPRICE', 'N_CHANGE', 'N_PERCENTCHANGE', 'N_HIGH', 'N_LOW'].forEach((id) => {
          document.getElementById(id).innerText = 'NA';
        });
      });
  }

  function fetchGoldData() {
    fetch(`${API_BASE_URL}/gold`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const metaParts = [data.location || 'India'];
        if (data.rateDate) metaParts.push(data.rateDate);
        document.getElementById('GOLD_META').innerText = metaParts.join(' • ');

        document.getElementById('GOLD_24K').innerText =
          `${formatInr(data.gold24kPrice)} (${formatInr(data.gold24kPerGram)}/g)`;
        document.getElementById('GOLD_22K').innerText =
          `${formatInr(data.gold22kPrice)} (${formatInr(data.gold22kPerGram)}/g)`;
        document.getElementById('SBI_GOLD_ETF').innerText = formatInr(data.sbiGoldEtfPrice);
        document.getElementById('ICICI_GOLD_ETF').innerText = formatInr(data.iciciGoldEtfPrice);
      })
      .catch((error) => {
        console.error('Gold fetch error:', error);
        document.getElementById('GOLD_META').innerText = 'Backend unavailable (port 4500)';
        ['GOLD_24K', 'GOLD_22K', 'SBI_GOLD_ETF', 'ICICI_GOLD_ETF'].forEach((id) => {
          document.getElementById(id).innerText = 'NA';
        });
      });
  }

  fetchNiftyData();
  fetchGoldData();

  setInterval(fetchNiftyData, 5000);
  setInterval(fetchGoldData, 30000);
});
