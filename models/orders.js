const db = require('../db');

async function getOrdersBySnapshotId(snapshotId) {
  try {
    const query = 'SELECT * FROM orders WHERE snapshot_id = $1';
    const result = await db.query(query, [snapshotId]);
    return result.rows;
  } catch (error) {
    throw error;
  }
}


async function getOrdersByUnixTimestamp(start, end) {
  try {
    const query = 'SELECT * FROM orders WHERE snapshot_id IN (select snapshot_id from snapshot where unix_ts_start between $1 and $2)';
    const result = await db.query(query, [start, end]);
    return result.rows;
  } catch (error) {
    throw error;
  }
}


module.exports = { getOrdersBySnapshotId };