const fs = require('fs');
const { ethers } = require('ethers');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const wallet = ethers.Wallet.createRandom();
const env = `PRIVATE_KEY=${wallet.privateKey}\nRPC_URL=https://rpc.botchain.ai\nCHAIN_ID=677\nEXPLORER=https://scan.botchain.ai\n`;

fs.writeFileSync(envPath, env, { mode: 0o600 });
console.log('Deployment wallet created.');
console.log('Address:', wallet.address);
console.log('.env written to', envPath);
