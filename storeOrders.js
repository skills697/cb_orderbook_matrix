const pool = require('./db');
const { getOrderBook } = require('./getOrders');

// Function to create the necessary tables if they don't exist
async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS snapshot (
      id SERIAL PRIMARY KEY,
      trading_pair VARCHAR(12) NOT NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      snapshot_id INTEGER REFERENCES snapshot(id) ON DELETE CASCADE,
      side VARCHAR(4) NOT NULL,
      min_price NUMERIC NOT NULL,
      max_price NUMERIC NOT NULL,
      total_size NUMERIC NOT NULL
    );
  `);
}

// Function to store the grouped buy and sell orders as a snapshot
async function storeOrders(tradingPair) {
  try {
    await createTables();

    const { buyOrderGroups, sellOrderGroups } = await getOrderBook(tradingPair);

    // Insert a new snapshot and get the snapshot ID
    const snapshotResult = await pool.query('INSERT INTO snapshot (trading_pair) VALUES ($1) RETURNING id', [tradingPair]);
    const snapshotId = snapshotResult.rows[0].id;

    // Insert buy orders
    for (const { minPrice, maxPrice, totalSize } of buyOrderGroups) {
      await pool.query(
        'INSERT INTO orders (snapshot_id, side, min_price, max_price, total_size) VALUES ($1, $2, $3, $4, $5)',
        [snapshotId, 'buy', minPrice, maxPrice, totalSize]
      );
    }

    // Insert sell orders
    for (const { minPrice, maxPrice, totalSize } of sellOrderGroups) {
      await pool.query(
        'INSERT INTO orders (snapshot_id, side, min_price, max_price, total_size) VALUES ($1, $2, $3, $4, $5)',
        [snapshotId, 'sell', minPrice, maxPrice, totalSize]
      );
    }

    console.log('Snapshot saved successfully with ID:', snapshotId);
  } catch (error) {
    console.error('Error storing orders:', error);
  } finally {
    pool.end();
  }
}

storeOrders('BTC-USD');
