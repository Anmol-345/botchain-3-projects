require('dotenv').config();
const fs = require('fs');
const { ethers } = require('ethers');

const bytecode = fs.readFileSync('ZenoPayment.bin', 'utf8').toString();

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const network = await provider.getNetwork();
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const balance = await wallet.getBalance();
  const gasPrice = await provider.getGasPrice();
  const estGas = await provider.estimateGas({ from: wallet.address, data: bytecode });
  const cost = estGas.mul(gasPrice);

  console.log('Chain ID:', network.chainId);
  console.log('Deployer:', wallet.address);
  console.log('Balance:', ethers.utils.formatEther(balance), 'BOT');
  console.log('Gas price:', ethers.utils.formatUnits(gasPrice, 'gwei'), 'gwei');
  console.log('Estimated gas:', estGas.toString());
  console.log('Estimated deployment cost:', ethers.utils.formatEther(cost), 'BOT');
}

main().catch(console.error);
