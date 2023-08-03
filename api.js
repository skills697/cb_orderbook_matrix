const express = require('express');
const homeRouter = require('./routes/homeRouter');

const {getSnapshots, getLatestSnapshot} = require("./models/snapshots");
const {getOrdersBySnapshotId, getOrdersByUnixTimestamp} = require("./models/orders");

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

// API endpoint to fetch orders for a given snapshot
app.get('/orders', async (req, res) => {
  try {
    const snapshot = req.query.snapshotId;
    const snapStart = req.query.startTime;
    const snapEnd = req.query.endTime;
    let orders;

    if (!snapshot && (!snapStart || !snapEnd)) {
      return res.status(400).send({ error: 'Please select orders by providing a valid snapshotId or start & end time.'});
    } else if(!snapshot){
      orders = getOrdersByUnixTimestamp(snapStart, snapEnd);
    } else {
      orders = getOrdersBySnapshotId(snapshot);
    }

    if(orders.length <= 0){
      return res.status(400).send({ error: 'No orders found'});
    }

    res.send(orders);

  } catch (error) {
    console.error('Error fetching snapshots:', error);
    res.status(500).send({ error: 'Error fetching snapshots' });
  }
});

app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
});