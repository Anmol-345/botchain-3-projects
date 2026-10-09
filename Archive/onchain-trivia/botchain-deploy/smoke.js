require('dotenv').config();
const fs = require('fs');
const { ethers } = require('ethers');

const abi = JSON.parse(fs.readFileSync('OnchainTrivia.abi', 'utf8'));
const contractAddress = process.env.CONTRACT_ADDRESS;
const explorer = 'https://scan.botchain.ai';
let spent = ethers.BigNumber.from(0);

async function send(txPromise, label) {
  const tx = await txPromise;
  const r = await tx.wait();
  spent = spent.add(r.gasUsed.mul(r.effectiveGasPrice));
  console.log(`${label}: ${explorer}/tx/${tx.hash} (gas ${r.gasUsed.toString()})`);
  return r;
}

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL || 'https://rpc.botchain.ai');
  const network = await provider.getNetwork();
  if (network.chainId !== 677) throw new Error('not BOT Chain');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const c = new ethers.Contract(contractAddress, abi, wallet);
  const gasPrice = await provider.getGasPrice();
  const opts = { gasPrice };

  const code = await provider.getCode(contractAddress);
  if (code === '0x') throw new Error('no code at contract');
  console.log('Code verified at', contractAddress);

  // submit a passing score -> should update best + leaderboard
  await send(c.submitScore(7, 8, opts), 'submitScore 7/8');
  let s = await c.getStats(wallet.address);
  if (s.best.toNumber() !== 7 || s.games.toNumber() !== 1) throw new Error('stats wrong');
  console.log('Stats ok: best', s.best.toString() + '/' + s.bestOf.toString(), 'games', s.games.toString());

  // lower score -> best stays, games increments
  await send(c.submitScore(2, 8, opts), 'submitScore 2/8');
  s = await c.getStats(wallet.address);
  if (s.best.toNumber() !== 7 || s.games.toNumber() !== 2) throw new Error('best overwritten');
  console.log('Best-score protection ok');

  // invalid score must revert
  try { await c.submitScore(9, 8, opts); throw new Error('bad score accepted'); }
  catch (e) { if (e.message === 'bad score accepted') throw e; console.log('Invalid score reverted ok'); }

  const lb = await c.getLeaderboard();
  if (lb[0][0].toLowerCase() !== wallet.address.toLowerCase()) throw new Error('leaderboard wrong');
  console.log('Leaderboard ok, #1 =', lb[0][0], lb[1][0].toString() + '/' + lb[2][0].toString());
  console.log('Player count:', (await c.playerCount()).toString());
  console.log('Smoke total spent:', ethers.utils.formatEther(spent), 'BOT');
}

main().catch((e) => { console.error('SMOKE FAILED:', e.message); process.exit(1); });
