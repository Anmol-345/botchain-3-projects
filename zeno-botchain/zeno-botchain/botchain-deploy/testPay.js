require('dotenv').config({ path: process.env.ENV_FILE || '.env' });
const fs = require('fs');
const { ethers } = require('ethers');
const abi = JSON.parse(fs.readFileSync('ZenoPayment.abi', 'utf8'));

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, wallet);
  const value = ethers.utils.parseEther('0.001');
  const tx = await contract.pay(wallet.address, 'Test BOT payment', { value, gasPrice: await provider.getGasPrice() });
  await tx.wait();
  console.log('Payment sent:', process.env.EXPLORER + '/tx/' + tx.hash);
}

main().catch(console.error);
