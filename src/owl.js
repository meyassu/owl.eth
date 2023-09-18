const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 3000;

let currentAverageFee = null;


async function updateFee(n = 5) {
    try {
        const endpoint = `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`;
        
        // get latest block number
        const latestResponse = await axios.post(endpoint, {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_blockNumber",
            params: []
        });
        let latestBlockNumber = parseInt(latestResponse.data.result, 16);  // convert hex to decimal

        // iterate through previous n blocks
        let numTransactions = BigInt(0);
        let totalPriorityFee = BigInt(0);
        for(let i = 0; i < n; i++) {
            
            // fetch block w/ transaction details
            const blockResponse = await axios.post(endpoint, {
                jsonrpc: "2.0",
                id: 1 + i,
                method: "eth_getBlockByNumber",
                params: ["0x" + latestBlockNumber.toString(16), true]
            });
            const block = blockResponse.data.result;
            if (!block) {
                console.error(`Could not fetch block ${blockNumber}`);
                latestBlockNumber--;
                return null;
            }

            // compute total priority fee
            const baseFeePerGas = BigInt(block.baseFeePerGas)
            block.transactions.forEach(tx => {
                const maxFeePerGas = BigInt(tx.maxFeePerGas);
                const priorityFee = tx.type === '0x2' ? maxFeePerGas - baseFeePerGas : BigInt(0);
                totalPriorityFee += priorityFee;
            });

            // compute cumulative number of transations
            numTransactions += BigInt(block.transactions.length);
            latestBlockNumber--;
            
        }

        // update average priority fee
        currentAverageFee = totalPriorityFee / numTransactions;
        console.log(`Updated average fee to: ${currentAverageFee.toString()}`);

    }

    catch (error) {
        console.error('Error fetching blocks:', error);
        return [];
    }
}


app.get('/fee', (req, res) => {
    if (currentAverageFee !== null) {
        res.json({ fee: currentAverageFee.toString() });
    } else {
        res.status(500).json({ error: 'Fee not available.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    updateFee();
    setInterval(updateFee, 60000);  // Update fee every minute.
});




