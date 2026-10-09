require('dotenv').config({ path: process.env.ENV_FILE || '.env' });
const fs = require('fs');
const { ethers } = require('ethers');

const abi = JSON.parse(fs.readFileSync('ZenoPayment.abi', 'utf8'));
const bytecode = fs.readFileSync('ZenoPayment.bin', 'utf8').toString();

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const network = await provider.getNetwork();
  console.log('Network:', network.name, 'chainId:', network.chainId);

  const expectedChainId = Number(process.env.EXPECTED_CHAIN_ID || process.env.CHAIN_ID || 677);
  if (network.chainId !== expectedChainId) {
    throw new Error(`Expected chainId ${expectedChainId}, got ${network.chainId}`);
  }

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const balance = await wallet.getBalance();
  console.log('Deployer:', wallet.address);
  console.log('Balance:', ethers.utils.formatEther(balance), 'BOT');

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const deployTx = factory.getDeployTransaction();
  const estGas = await wallet.estimateGas(deployTx);
  const gasPrice = await provider.getGasPrice();
  const cost = estGas.mul(gasPrice);
  console.log('Estimated gas:', estGas.toString());
  console.log('Gas price:', ethers.utils.formatUnits(gasPrice, 'gwei'), 'gwei');
  console.log('Estimated cost:', ethers.utils.formatEther(cost), 'BOT');

  const contract = await factory.deploy({ gasLimit: estGas.mul(12).div(10), gasPrice });
  await contract.deployed();

  console.log('Contract deployed:', contract.address);
  console.log('Transaction:', process.env.EXPLORER + '/tx/' + contract.deployTransaction.hash);
  console.log('Spent:', ethers.utils.formatEther(contract.deployTransaction.gasLimit.mul(contract.deployTransaction.gasPrice || gasPrice)), 'BOT');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
