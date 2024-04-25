

document.addEventListener('DOMContentLoaded', function () {

  function fetchData(url, successCallback, errorCallback) {
    fetch(url)
      .then(response => response.json())
      .then(successCallback)
      .catch(errorCallback);
  }

  function updateDataAndChart(data, lastPriceElement, changeElement, percentChangeElement, highElement, lowElement, priceChart, currentPriceDotClass) {
    let data_price = data.indices.lastprice;
    let data_change = data.indices.change;
    let data_percentchange = data.indices.percentchange;
    let data_high = data.indices.high;
    let data_low = data.indices.low;

    lastPriceElement.innerText = data_price;
    changeElement.innerText = data_change;
    percentChangeElement.innerText = data_percentchange;
    highElement.innerText = data_high;
    lowElement.innerText = data_low;

    const int_data_price = parseFloat(data_price.replace(/,/g, ''));
    const int_data_low = parseFloat(data_low.replace(/,/g, ''));
    const int_data_high = parseFloat(data_high.replace(/,/g, ''));
    const percentage = ((int_data_price - int_data_low) / (int_data_high - int_data_low)) * 100;

    priceChart.style.width = `${percentage}%`;

    const previousDot = document.querySelector(`.${currentPriceDotClass}`);
    if (previousDot) {
      previousDot.remove();
    }

    const currentPriceDot = document.createElement('div');
    currentPriceDot.className = currentPriceDotClass;
    currentPriceDot.style.left = `${percentage}%`;
    priceChart.appendChild(currentPriceDot);
  }

  function handleFetchError(error, resultElement) {
    console.error('NA:', error);
    resultElement.innerText = 'NA.';
  }

  function fetchAndUpdateData(url, lastPriceElement, changeElement, percentChangeElement, highElement, lowElement, priceChart, currentPriceDotClass, resultElement) {
    fetchData(url,
      (data) => updateDataAndChart(data, lastPriceElement, changeElement, percentChangeElement, highElement, lowElement, priceChart, currentPriceDotClass),
      (error) => handleFetchError(error, resultElement)
    );
  }

  // Call the function immediately
  fetchAndUpdateData(
    'https://appfeeds.moneycontrol.com/jsonapi/market/indices&format=json&t_device=iphone&t_app=MC&t_version=48&ind_id=23',
    document.getElementById('BN_LASTPRICE'),
    document.getElementById('BN_CHANGE'),
    document.getElementById('BN_PERCENTCHANGE'),
    document.getElementById('BN_HIGH'),
    document.getElementById('BN_LOW'),
    document.getElementById('BN_PRICE_CHART'),
    'bn-current-price-dot',
    document.getElementById('resultBN')
  );

  fetchAndUpdateData(
    'https://appfeeds.moneycontrol.com/jsonapi/market/indices&format=json&t_device=iphone&t_app=MC&t_version=48&ind_id=9',
    document.getElementById('N_LASTPRICE'),
    document.getElementById('N_CHANGE'),
    document.getElementById('N_PERCENTCHANGE'),
    document.getElementById('N_HIGH'),
    document.getElementById('N_LOW'),
    document.getElementById('N_PRICE_CHART'),
    'n-current-price-dot',
    document.getElementById('resultN')
  );
  fetchOptionData();

  // Call the function every 2 seconds
  setInterval(function () {
    fetchAndUpdateData(
      'https://appfeeds.moneycontrol.com/jsonapi/market/indices&format=json&t_device=iphone&t_app=MC&t_version=48&ind_id=23',
      document.getElementById('BN_LASTPRICE'),
      document.getElementById('BN_CHANGE'),
      document.getElementById('BN_PERCENTCHANGE'),
      document.getElementById('BN_HIGH'),
      document.getElementById('BN_LOW'),
      document.getElementById('BN_PRICE_CHART'),
      'bn-current-price-dot',
      document.getElementById('resultBN')
    );

    fetchAndUpdateData(
      'https://appfeeds.moneycontrol.com/jsonapi/market/indices&format=json&t_device=iphone&t_app=MC&t_version=48&ind_id=9',
      document.getElementById('N_LASTPRICE'),
      document.getElementById('N_CHANGE'),
      document.getElementById('N_PERCENTCHANGE'),
      document.getElementById('N_HIGH'),
      document.getElementById('N_LOW'),
      document.getElementById('N_PRICE_CHART'),
      'n-current-price-dot',
      document.getElementById('resultN')
    );
    fetchOptionData();
  }, 5000);


  function fetchOptionData() {
    var callstrike = document.getElementById('callstrike');
    var callprice = document.getElementById('callprice');
    fetch('http://localhost:4500/upstox/call/fetchData', {
      method: 'GET',
    })
    .then(response => response.json())
    .then(data => {
      data.callKey = parseFloat(data.callKey);
      callstrike.innerText = JSON.stringify(data.callKey);
      callprice.innerText = JSON.stringify(data.ltp);
    })
    .catch(error => {
      callstrike.innerText = 'NA';
      callprice.innerText = 'NA';
    });
  
    var putstrike = document.getElementById('putstrike');
    var putprice = document.getElementById('putprice');
    fetch('http://localhost:4500/upstox/put/fetchData', {
      method: 'GET',
    })
    .then(response => response.json())
    .then(data => {
      data.putKey = parseFloat(data.putKey);
      putstrike.innerText = JSON.stringify(data.putKey);
      putprice.innerText = JSON.stringify(data.ltp);
    })
    .catch(error => {
      putstrike.innerText = 'NA';
      putprice.innerText = 'NA';
    });
  }
  // fetchOptionData();
  // Call fetchData function every 5 seconds
  // setInterval(fetchOptionData, 5000);
  

  // var callstrike = document.getElementById('callstrike');
  // var callprice = document.getElementById('callprice');
  // fetch('http://localhost:9000/upstox/call/fetchData', {
  //   method: 'GET',

  // })
  //   .then(response => response.json())
  //   .then(data => {
  //     data.callKey = parseFloat(data.callKey);
  //     callstrike.innerText = JSON.stringify(data.callKey);
  //     callprice.innerText = JSON.stringify(data.ltp);
  //   })
  //   .catch(error => {
  //     callstrike.innerText = 'NA';
  //     callprice.innerText = 'NA';
  //   });



  // var putstrike = document.getElementById('putstrike');
  // var putprice = document.getElementById('putprice');
  // fetch('http://localhost:9000/upstox/put/fetchData', {
  //   method: 'GET',

  // })
  //   .then(response => response.json())
  //   .then(data => {
  //     data.putKey = parseFloat(data.putKey);
  //     putstrike.innerText = JSON.stringify(data.putKey);
  //     putprice.innerText = JSON.stringify(data.ltp);
  //   })
  //   .catch(error => {
  //     putstrike.innerText = 'NA';
  //     putprice.innerText = 'NA';
  //   });


});
