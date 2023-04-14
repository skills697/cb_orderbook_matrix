// Import the getOrderBook function from the getOrders.js file
const { getOrderBook } = require('./getOrders');

// Call the getOrderBook function and process the results
getOrderBook()
  .then(({ buyOrderGroups, sellOrderGroups }) => {
    console.log('Grouped buy orders:');
    console.table(buyOrderGroups);
    console.log('Grouped sell orders:');
    console.table(sellOrderGroups);
  })
  .catch(error => {
    console.error('Error fetching grouped orders:', error);
  });