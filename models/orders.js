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

module.exports = { getOrdersBySnapshotId };