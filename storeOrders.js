/*
* Module: storeOrders.js
* Author: Patrick Howe
* Description: This module supports database calls between the application and the DB tables
*              Used to store and read the orderbook data for a specified trading pair.
*/

const pool = require('./db');

let initTableSetup = false;

// Function to create the necessary tables if they don't exist
async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS snapshot (
      snapshot_id SERIAL PRIMARY KEY,
      trading_pair VARCHAR(12) NOT NULL,
      unix_ts_start INTEGER NOT NULL,
      price_low NUMERIC NOT NULL,
      price_high NUMERIC NOT NULL,
      price_open NUMERIC NOT NULL,
      price_close NUMERIC NOT NULL,
      volume NUMERIC NOT NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      snapshot_id INTEGER REFERENCES snapshot(snapshot_id) ON DELETE CASCADE,
      side VARCHAR(4) NOT NULL,
      min_price NUMERIC NOT NULL,
      max_price NUMERIC NOT NULL,
      total_size NUMERIC NOT NULL
    );
  `);
  return true;
};


//Function to store a new snapshot and return its ID value
async function storeSnapshot(tradingPair, start, low, high, open, close, volume) {
  initTableSetup = initTableSetup || await createTables();
    // Insert a new snapshot and get the snapshot ID
    const snapshotResult = await pool.query(
      'INSERT INTO snapshot (trading_pair, unix_ts_start, price_low, price_high, price_open, price_close, volume)' +
      ' VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING snapshot_id',
     [tradingPair, start, low, high, open, close, volume]);
    return snapshotResult.rows[0].id;
};

//Function to store an order for a snapshot
async function storeOrders(snapshotId, side, minPrice, maxPrice, totalSize) {
  initTableSetup = initTableSetup || await createTables();
  await pool.query(
    'INSERT INTO orders (snapshot_id, side, min_price, max_price, total_size) VALUES ($1, $2, $3, $4, $5)',
    [snapshotId, side, minPrice, maxPrice, totalSize]
  );
};

module.exports = {
  storeSnapshot,
  storeOrders
};


