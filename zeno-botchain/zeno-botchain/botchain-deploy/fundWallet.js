require('dotenv').config({ path: process.env.ENV_FILE || '.env.funder' });
const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const recipient = process.env.RECIPIENT;
  const amount = ethers.utils.parseEther(process.env.AMOUNT || '0.015');
  console.log('Funder:', wallet.address);
  console.log('Recipient:', recipient);
  const bal = await wallet.getBalance();
  console.log('Funder balance:', ethers.utils.formatEther(bal), 'BOT');
  const tx = await wallet.sendTransaction({
    to: recipient,
    value: amount,
    gasPrice: await provider.getGasPrice(),
  });
  await tx.wait();
  console.log('Funded:', process.env.EXPLORER + '/tx/' + tx.hash);
  const newBal = await provider.getBalance(recipient);
  console.log('Recipient balance:', ethers.utils.formatEther(newBal), 'BOT');
}

main().catch(console.error);
