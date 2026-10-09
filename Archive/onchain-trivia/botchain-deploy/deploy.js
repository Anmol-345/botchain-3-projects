require('dotenv').config();
const fs = require('fs');
const { ethers } = require('ethers');

const abi = JSON.parse(fs.readFileSync('OnchainTrivia.abi', 'utf8'));
const bytecode = fs.readFileSync('OnchainTrivia.bin', 'utf8').toString();

async function main() {
  const rpcUrl = process.env.RPC_URL || 'https://rpc.botchain.ai';
  const explorer = 'https://scan.botchain.ai';
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  console.log('Network chainId:', network.chainId);
  if (network.chainId !== 677) throw new Error(`Expected chainId 677, got ${network.chainId}`);

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
  console.log('Transaction:', explorer + '/tx/' + contract.deployTransaction.hash);
  const receipt = await contract.deployTransaction.wait();
  console.log('Actual gas used:', receipt.gasUsed.toString());
  console.log('Spent:', ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice || gasPrice)), 'BOT');
}

main().catch((err) => { console.error(err); process.exit(1); });
