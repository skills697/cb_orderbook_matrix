const db = require('../db');

async function getOrdersBySnapshotId(snapshotId) {
  try {
    const query = 'SELECT orders.*, snapshot.unix_ts_start' +
        'FROM orders INNER JOIN snapshot ON (orders.snapshot_id = snapshot.snapshot_id) ' +
        'WHERE snapshot_id = $1';
    const result = await db.query(query, [snapshotId]);
    return result.rows;
  } catch (error) {
    throw error;
  }
}


async function getOrdersByUnixTimestamp(start, end) {
  try {
    const query = 'SELECT orders.*, snapshot.unix_ts_start ' +
        'FROM orders JOIN snapshot ON (orders.snapshot_id = snapshot.snapshot_id) ' +
        'WHERE orders.snapshot_id IN (select snapshot_id from snapshot where unix_ts_start between $1 and $2) ' +
        'ORDER BY orders.snapshot_id, id DESC';
    const result = await db.query(query, [start, end]);
    return result.rows.reduce((acc, order) => {
      if(acc[order.unix_ts_start]){
        acc[order.unix_ts_start].orders.push({
          "id": order.id,
          "side": order.side,
          "min": order.min_price,
          "max": order.max_price,
          "total": order.total_size
        });
      } else {
        acc[order.unix_ts_start] = {
        "snapshot": order.unix_ts_start,
        "orders": [{
          "id": order.id,
          "side": order.side,
          "min": order.min_price,
          "max": order.max_price,
          "total": order.total_size
          }]
        };
      }
      return acc;
    }, {});
  } catch (error) {
    throw error;
  }
}


module.exports = { getOrdersBySnapshotId, getOrdersByUnixTimestamp };