const express = require('express');
const exphbs = require('express-handlebars');
const pool = require('./db');
const homeRouter = require('./routes/homeRouter');

const app = express();
const port = 3000;

// Configure Handlebars as the template engine
app.engine('hbs', exphbs({ extname: '.hbs' }));
app.set('view engine', 'hbs');

// Serve static files from the /public directory
app.use(express.static('public'));

// Load and set up the home route
app.use('/', homeRouter);

app.use(express.json());

// API endpoint to fetch snapshots and their orders for a given trading pair and date range
app.get('/snapshots', async (req, res) => {
  try {
    const tradingPair = req.query.tradingPair;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate || 'infinity';

    if (!tradingPair || !startDate) {
      return res.status(400).send({ error: 'Please provide a tradingPair and startDate query parameters' });
    }

    // Fetch snapshots for the given trading pair and date range
    const snapshotResult = await pool.query(
      `SELECT * FROM snapshot
       WHERE trading_pair = $1
       AND timestamp BETWEEN $2 AND $3
       ORDER BY timestamp`,
      [tradingPair, startDate, endDate]
    );

    const snapshots = snapshotResult.rows;

    // Fetch orders for each snapshot
    for (const snapshot of snapshots) {
      const ordersResult = await pool.query('SELECT * FROM orders WHERE snapshot_id = $1', [snapshot.id]);
      snapshot.orders = ordersResult.rows;
    }

    res.json({ snapshots });
  } catch (error) {
    console.error('Error fetching snapshots:', error);
    res.status(500).send({ error: 'Error fetching snapshots' });
  }
});

app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
});