const db = require('../db');

async function getSnapshots(start, end) {
  try {
    const query = 'SELECT * FROM snapshot WHERE unix_ts_start ' + ((end)? 'BETWEEN $1 AND $2;' : " >= $1;");
    const result = await db.query(query, [start, end]);
    return result.rows;
  } catch (error) {
    throw error;
  }
}

async function getLatestSnapshot() {
    try {
      const query = 'SELECT * FROM snapshot WHERE unix_ts_start = (SELECT MAX(unix_ts_start) from snapshot); ';
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

module.exports = { getSnapshots, getLatestSnapshot };