/*
* Node Script: fetch.js
* Author: Patrick Howe
* Description: Just a simple script which runs every 5 minutes to both retrieve and store orderbook data.
*/

const { storeOrders, storeSnapshot } = require("./storeOrders");
const { getOrderBook, getCurrentCandles, getCandles } = require('./getOrders');

function sleep(sec) {
    console.log("\n************************************************************************************************");
    console.log("************************************************************************************************\n");
    return new Promise((resolve) => {
        setTimeout(resolve, sec * 1000);
    });
};

const run = async function runScript(tradingPair) {
    tradingPair = tradingPair||'BTC-USD';
    let running = true;
    let lastStart = 0;
    let curr = { "start": lastStart };

    while(running) {
        console.log("Fetching and Storing Snapshot of Order Book");
        console.time("FetchOrders");

        try {
            //check for new candles, if no new set of candles found, sleep 1 second.
            while(curr.start == lastStart){
                await sleep(1);
                curr = (await getCurrentCandles(tradingPair, 600))[0];
            }
    
            // Insert a new snapshot and get the snapshot ID
            const snapId = await storeSnapshot(tradingPair, curr.start, curr.low, curr.high, curr.open, curr.close, curr.volume);
            
            console.log("Created a new snapshotID: " + snapId);
            console.log("New Start Time: " + curr.start + ", Last: " + lastStart);
    
            // Fetch coinbase exchange data to be stored
            const { buyOrderGroups, sellOrderGroups } = await getOrderBook(tradingPair);

            // Insert buy orders
            for (const { minPrice, maxPrice, totalSize } of buyOrderGroups) {
                await storeOrders(snapId, 'buy', minPrice, maxPrice, totalSize);
            }
            console.log("Stored " + buyOrderGroups.length + " new buy orders.");
    
            // Insert sell orders
            for (const { minPrice, maxPrice, totalSize } of sellOrderGroups) {
                await storeOrders(snapId, 'sell', minPrice, maxPrice, totalSize);
            }
            console.log("Stored " + sellOrderGroups.length + " new sell orders.");

        } catch (error) {
            running = false;
            console.error('Error fetching orders:', error);

        } finally {
            lastStart = curr.start;
        }
        
        // Sleep fetch process
        if(!running) break;
        console.timeEnd("FetchOrders");
        console.log("Completed Store Order Book.\nSleeping...");
        await sleep(290);
    }
    return 1;
};

run();