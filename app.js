const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const app = express();
const bodyParser = require('body-parser');
const CircularJSON = require('circular-json');


app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 4500;
app.use(cors());
app.use(express.json());

app.get('/banknifty', async (req, res) => {
    try {
        const response = await axios.get('https://appfeeds.moneycontrol.com/jsonapi/market/indices&format=json&t_device=iphone&t_app=MC&t_version=48&ind_id=23');
        const data = response.data;
    
        // Convert data to a circular reference-safe JSON string
        const jsonObject = CircularJSON.parse(CircularJSON.stringify(data));
    
        // Send the JSON string as the response
        res.send(jsonObject);
    } catch (error) {
      console.error('Error fetching data:', error);
      res.status(500).json({ error: 'Failed to fetch data from Moneycontrol API' });
    }
  });

  app.get('/nifty50', async (req, res) => {
    try {
        const response = await axios.get('https://appfeeds.moneycontrol.com/jsonapi/market/indices&format=json&t_device=iphone&t_app=MC&t_version=48&ind_id=9');
        const data = response.data;
    
        // Convert data to a circular reference-safe JSON string
        const jsonObject = CircularJSON.parse(CircularJSON.stringify(data));
    
        // Send the JSON string as the response
        res.send(jsonObject);
    } catch (error) {
      console.error('Error fetching data:', error);
      res.status(500).json({ error: 'Failed to fetch data from Moneycontrol API nifty50' });
    }
  });

app.get('/upstox/call/fetchData', async (req, res) => {
    const { expiryDate, upstoxurl, callKey, putKey } = require('./expiary_strike_data.js');
    try {
        const response = await axios.get(upstoxurl + expiryDate);
        const upstoxdata = response.data.data.strategyChainData.strikeMap;

        const objectForcall = upstoxdata[callKey];
        const ltp = objectForcall.callOptionData.marketData.ltp;

        res.json({ callKey, ltp });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Error fetching data' });
    }
});
app.get('/upstox/put/fetchData', async (req, res) => {
    const { expiryDate, upstoxurl, callKey, putKey } = require('./expiary_strike_data.js');
    try {
        const response = await axios.get(upstoxurl + expiryDate);
        const upstoxdata = response.data.data.strategyChainData.strikeMap;

        const objectForPut = upstoxdata[putKey];

        const ltp = objectForPut.putOptionData.marketData.ltp;

        res.json({ putKey, ltp });
    } catch (error) {
        console.error('Error fetching data:', error.message);
        res.status(500).json({ error: 'Error fetching data' });
    }
});


app.post('/updateData/:key', (req, res) => {
    const { expiryDate, upstoxurl, callKey, putKey } = require('./expiary_strike_data.js');
    let data = require('./expiary_strike_data.js');
    const { key } = req.params;
    let { value } = req.body;
    if (key === 'expiryDate') {
        console.log("date");
        const parts = value.split('-');
        const formattedDate = parts[2] + '-' + parts[1] + '-' + parts[0];
        value = formattedDate;
    }
    else{
        console.log("call put");
        value = parseInt(value);
        value = value.toFixed(1);
    }
    if (data.hasOwnProperty(key)) {
        data[key] = value;
        fs.writeFile('./expiary_strike_data.js', `module.exports = ${JSON.stringify(data, null, 2)};`, err => {
            if (err) {
                console.error(err);
                res.status(500).send('Error updating data');
            } else {
                res.status(200).send('Data updated successfully');
            }
        });
    } else {
        res.status(404).send('Key not found');
    }
});

app.get('/fetchSVG', async (req, res) => {
    try {
        const response = await axios.get('https://nsearchives.nseindia.com/today/RELIANCEEQN.svg', {
            responseType: 'arraybuffer',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'
            }
        });
        const svgData = response.data;
        res.set('Content-Type', 'image/svg+xml');
        res.send(svgData);
    } catch (error) {
        console.error('Error fetching SVG:', error.message);
        res.status(500).json({ error: 'Error fetching SVG' });
    }
});

app.get('/', async (req, res) => {
    try {
        res.send({msg:"msg from server"});
    } catch (error) {
        res.status(500).json({ error: 'Error fetching SVG' });
    }
});
function printHello() {
    axios.get('https://live-banknifty-option-data.onrender.com/verify')
        .then(response => {
            console.log('API called successfully:');
        })
        .catch(error => {
            console.error('Error occurred while calling API:');
        });
}

setInterval(printHello, 10000); 

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});






























