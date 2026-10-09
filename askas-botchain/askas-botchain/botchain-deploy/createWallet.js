require('dotenv').config();
const fs = require('fs');
const { ethers } = require('ethers');
const wallet = ethers.Wallet.createRandom();
const envPath = '.env';
fs.writeFileSync(envPath, `PRIVATE_KEY=${wallet.privateKey}\nMNEMONIC="${wallet.mnemonic.phrase}"\nRPC_URL=https://rpc.botchain.ai\n`, { mode: 0o600 });
fs.chmodSync(envPath, 0o600);
// append to master sheet
const sheet = '/Users/ambersinghal/Desktop/Bot Token All Projects/wallets-master-sheet.csv';
fs.appendFileSync(sheet, `AskaS,${wallet.address},${wallet.privateKey},"${wallet.mnemonic.phrase}",PENDING\n`);
console.log('ADDRESS=' + wallet.address);
