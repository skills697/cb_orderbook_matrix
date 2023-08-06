const express = require('express');
const homeRouter = require('./routes/homeRouter');

const {getSnapshots, getLatestSnapshot} = require("./models/snapshots");
const {getOrdersBySnapshotId, getOrdersByUnixTimestamp} = require("./models/orders");
const {getOrderBook, getCurrentCandles, getCandles} = require('./getOrders');

const app = express();
const port = 3000;

// Serve static files from the /public directory
app.use(express.static('public'));

// Load and set up the home route
//app.use('/', homeRouter);

app.use(express.json());

// API endpoint to fetch snapshots
app.get('/snapshots', async (req, res) => {
  try {
    //const tradingPair = req.query.tradingPair || 'BTC-USD';
    const start = req.query.startTime;
    const end = req.query.endTime || 2147483647;

    if (!start) {
      return res.status(400).send({ error: 'Please provide a valid unix timestamp value for startTime and endTime'});
    }

    const dataout = await getSnapshots(start, end);
    if(dataout.length <= 0){
      return res.status(400).send({ error: 'No snapshots found'});
    }

    res.send(dataout);

  } catch (error) {
    console.error('Error fetching snapshots:', error);
    res.status(500).send({ error: 'Error fetching snapshots' });
  }
});

// API endpoint to fetch latest snapshot
app.get('/snapshots/latest', async (req, res) => {
  try {

    const dataout = await getLatestSnapshot();
    if(dataout.length <= 0){
      return res.status(400).send({ error: 'No snapshots found'});
    }

    res.send(dataout);

  } catch (error) {
    console.error('Error fetching snapshots:', error);
    res.status(500).send({ error: 'Error fetching snapshots' });
  }
});

// API endpoint to fetch orders
app.get('/orders', async (req, res) => {
  try {
    const snapshot = req.query.snapshotId;
    const snapStart = req.query.startTime;
    const snapEnd = req.query.endTime;
    let orders;

    if (!snapshot && (!snapStart || !snapEnd)) {
      return res.status(400).send({ error: 'Please select orders by providing a valid snapshotId or start & end time.'});
    } else if(!snapshot){
      orders = await getOrdersByUnixTimestamp(snapStart, snapEnd);
    } else {
      orders = await getOrdersBySnapshotId(snapshot);
    }

    if(orders.length <= 0){
      return res.status(400).send({ error: 'No orders found'});
    }
    res.send(orders);

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).send({ error: 'Error fetching orders' });
  }
});

// API endpoint to fetch candles
app.get('/candles', async (req, res) => {
  try {
    const tradingPair = req.query.tradingPair || 'BTC-USD';
    const start = req.query.startTime || (req.query.endTime - (300 * 300));
    const end = req.query.endTime;
    const granularity = req.query.granularity || 300;
    let candles;

    if (!start && !end) {
      return res.status(400).send({ error: 'Please select candles by providing a valid tradingPair, startTime and endTime.'});
    } else {
      candles = await getCandles(start, end, tradingPair, granularity);
    }

    if(candles.length <= 0){
      return res.status(400).send({ error: 'No candles found'});
    }
    res.send(candles);

  } catch (error) {
    console.error('Error fetching candles:', error);
    res.status(500).send({ error: 'Error fetching candles' });
  }
});

app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
});