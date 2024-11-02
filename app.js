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

const checkTime = () => {
    const currentDate = new Date();
    
    // Convert to IST (Asia/Kolkata)
    const options = {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,  // 24-hour format
    };
  
    const { hour, minute } = new Intl.DateTimeFormat('en-IN', options)
      .formatToParts(currentDate)
      .reduce((acc, part) => {
        if (part.type === 'hour') acc.hour = part.value;
        if (part.type === 'minute') acc.minute = part.value;
        return acc;
      }, {});
  
    console.log(`Current Time in IST: ${hour}:${minute}`);
  
    // Check if it's 09:30 AM IST
    if (hour === '09' && minute === '30') {
      return true;
    }
    else{
        return false;
    }

  };

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


app.get('/getData', (req, res) => {
    fs.readFile('data.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return res.status(500).json({ error: 'Error fetching data' });
        }

        try {
            // Step 2: Parse the JSON string into an array of objects
            const jsonArray = JSON.parse(data);
            jsonArray.sort((a, b) => {
                const dateA = new Date(a.date.split('/').reverse().join('-'));
                const dateB = new Date(b.date.split('/').reverse().join('-'));
                return dateB - dateA; // Sort in descending order
            });
            res.json(jsonArray); // Send the parsed JSON array as the response
        } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
            res.status(500).json({ error: 'Error parsing data' });
        }
    });
});


app.get('/resultData', (req, res) => {
    fs.readFile('resultData.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return res.status(500).json({ error: 'Error fetching data' });
        }

        try {
            // Step 2: Parse the JSON string into an array of objects
            const jsonArray = JSON.parse(data);
            
            res.json(jsonArray.slice(0, 50)); // Send the parsed JSON array as the response
        } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
            res.status(500).json({ error: 'Error parsing data' });
        }
    });
});

function printHello() {
    axios.get('https://live-banknifty-option-data.onrender.com/')
        .then(response => {
            console.log('API called successfully:');
        })
        .catch(error => {
            console.error('Error occurred while calling API:');
        });
}
setInterval(printHello, 10000); 



const algo  = async ()=> {
    if (checkTime()) {
        const { expiryDate, upstoxurl, callKey, putKey } = require('./expiary_strike_data.js');


        const response = await axios.get(upstoxurl + expiryDate);
        const upstoxdata = response.data.data.strategyChainData.strikeMap;
        // console.log(typeof(upstoxdata));
        let callfind = false;
        let callPriceKey ;
        let callvalue;
    
        let putfind = false;
        let putPriceKey ;
        let putvalue;
        const keys = Object.keys(upstoxdata);
    
        keys.forEach((key, index) => {
            const prevKey = index > 0 ? keys[index - 1] : null;
             if (upstoxdata[key].callOptionData.marketData.ltp < 100 && !callfind ) {
                callfind = true;
                // console.log('call side ',prevKey,upstoxdata[prevKey].callOptionData.marketData.ltp);
                callPriceKey = prevKey;
                callvalue = upstoxdata[prevKey].callOptionData.marketData.ltp;
            } 
            if (upstoxdata[key].putOptionData.marketData.ltp > 100 && !putfind ) {
                putfind = true;
                // console.log('put side',key,upstoxdata[key].putOptionData.marketData.ltp);
                putPriceKey = key
                putvalue = upstoxdata[key].putOptionData.marketData.ltp
            } 
        });
        // console.log(callPriceKey, putPriceKey);
        const curr_date = new Date().toLocaleDateString('en-GB');
    
    
        const newData = { date: curr_date, callPriceKey : parseInt(callPriceKey) , callvalue , putPriceKey : parseInt(putPriceKey) , putvalue };
        // console.log(newData);
    
        // Step 1: Read the existing JSON file
        fs.readFile('data.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return;
        }
    
        try {
            // Step 2: Parse the JSON string into an array of objects
            const jsonArray = JSON.parse(data);
    
            // Step 3: Add the new data to the array
            jsonArray.push(newData);
    
            // Step 4: Convert the updated array back to a JSON string
            const updatedJson = JSON.stringify(jsonArray, null, 2);
    
            // Step 5: Write the updated JSON back to the file
            fs.writeFile('data.json', updatedJson, (err) => {
            if (err) {
                console.error('Error writing to file:', err);
            } else {
                console.log('Data has been added and file updated successfully.');
            }
            });
        } catch (parseErr) {
            console.error('Error parsing JSON:', parseErr);
        }
        });
    }
    
   
}
// algo();

setInterval(algo, 60 * 1000); 


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


function getResult() {
    const axios = require('axios'); // Make sure to import axios if not already imported

    // Get the current date
    const currentDate = new Date();
    
    // Calculate the start and end dates
    const startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - 30); // 30 days before today
    const endDate = new Date(currentDate);
    endDate.setDate(currentDate.getDate() + 30); // 30 days after today

    // Format dates as YYYY-MM-DD
    const startDateString = startDate.toISOString().split('T')[0];
    const endDateString = endDate.toISOString().split('T')[0];
    const resultData= []

    // Loop through pages 1 to 50
    const promises = [];
    for (let page = 1; page <= 100; page++) {
        const url = `https://api.moneycontrol.com/mcapi/v1/earnings/get-earnings-data?indexId=All&page=${page}&startDate=${startDateString}&endDate=${endDateString}&sector=&limit=20&sortBy=marketcap&search=&seq=desc`;
        promises.push(axios.get(url));
    }

    // Execute all requests
    Promise.all(promises)
        .then(responses => {
            responses.forEach(response => {
                // console.log(response.data.data);
                resultData.push(...response.data.data.list);
                // console.log('Current length of resultData:', resultData.length);
            });
            resultData.sort((a, b) => b.marketCap - a.marketCap);

            fs.writeFile('resultData.json', JSON.stringify(resultData, null, 2), (err) => {
                if (err) {
                    console.error('Error writing to file:', err);
                } else {
                    console.log('Current length of resultData:erer', resultData.length);
                    console.log('Data successfully saved to resultData.json');
                }
            });
    
            console.log('Final length of resultData:', resultData.length);
        })
        .catch(error => {
            console.error('Error occurred while calling API:', error);
        });
}

// Call the function
getResult();

setInterval(getResult, 24 * 60 * 60 * 1000); 



  


























