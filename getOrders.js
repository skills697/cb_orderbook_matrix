// Import necessary package
const CoinbasePro = require('coinbase-pro');

// Set up Coinbase Pro API client
const apiURI = 'https://api.pro.coinbase.com';
const publicClient = new CoinbasePro.PublicClient(apiURI);

// Define the product (asset) you want to get the order book for
const product = 'BTC-USD';

// Function to group orders based on a price range and sum their sizes
function groupOrders(buyOrders, sellOrders) {  
  const numPriceRanges = 100;

  // Helper function to calculate the sum of sizes within a price range
  function sumSizesInRange(orders, minPrice, maxPrice) {
    return orders
      .filter(order => order.price >= minPrice && order.price < maxPrice)
      .reduce((sum, order) => sum + Number(order.size), 0);
  }

  // Find the highest buy price and lowest sell price
  const highestBuyPrice = Math.max(...buyOrders.map(order => order.price));
  const lowestSellPrice = Math.min(...sellOrders.map(order => order.price));

  // Calculate price range size for buy and sell orders
  const buyRangeSize = highestBuyPrice / numPriceRanges;
  const sellRangeSize = lowestSellPrice / numPriceRanges;

  // Group buy orders
  const buyOrderGroups = [];
  for (let i = 0; i < numPriceRanges; i++) {
    const minPrice = i * buyRangeSize;
    const maxPrice = (i + 1) * buyRangeSize;
    const totalSize = sumSizesInRange(buyOrders, minPrice, maxPrice);
    buyOrderGroups.push({ minPrice, maxPrice, totalSize });
  }

  // Group sell orders
  const sellOrderGroups = [];
  for (let i = 0; i < numPriceRanges; i++) {
    const minPrice = lowestSellPrice + i * sellRangeSize;
    const maxPrice = lowestSellPrice + (i + 1) * sellRangeSize;
    const totalSize = sumSizesInRange(sellOrders, minPrice, maxPrice);
    sellOrderGroups.push({ minPrice, maxPrice, totalSize });
  }

  return { buyOrderGroups, sellOrderGroups };
};

// Fetch buy and sell orders from the exchange and group them
function getOrderBook() {
  return new Promise((resolve, reject) => {
    publicClient.getProductOrderBook(product, { level: 2 }, (error, response, data) => {
      if (error) {
        reject(error);
        return;
      }

      const buyOrders = data.bids.map(([price, size]) => ({ price: parseFloat(price), size: parseFloat(size) }));
      const sellOrders = data.asks.map(([price, size]) => ({ price: parseFloat(price), size: parseFloat(size) }));

      const groupedOrders = groupOrders(buyOrders, sellOrders);
      resolve(groupedOrders);
    });
  });
};

module.exports = {
  getOrderBook,
};