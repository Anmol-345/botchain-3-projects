// Onchain Trivia — BOT Chain frontend
const QUESTIONS = [
  { q: 'What does "EVM" stand for?', o: ['Ethereum Virtual Machine', 'Electronic Voting Module', 'Encrypted Vault Mechanism', 'Ethereum Value Metric'], a: 0 },
  { q: 'What is the native currency of BOT Chain?', o: ['ETH', 'BOT', 'MATIC', 'BNB'], a: 1 },
  { q: 'What is a smart contract?', o: ['A legal PDF signed online', 'Self-executing code stored on a blockchain', 'An AI chatbot agreement', 'A type of crypto wallet'], a: 1 },
  { q: 'What does "gas" pay for on a blockchain?', o: ['Storage space on your phone', 'Computational work of transactions', 'Miner hardware costs only', 'Website hosting'], a: 1 },
  { q: 'Which of these proves you control an address?', o: ['Your username', 'Your email', 'Your private key', 'Your IP address'], a: 2 },
  { q: 'What is a blockchain "explorer" used for?', o: ['Mining new blocks', 'Viewing transactions, blocks and contracts', 'Storing private keys', 'Trading NFTs only'], a: 1 },
  { q: 'What is a "wallet" in crypto?', o: ['A physical USB stick only', 'A bank account', 'Software/hardware managing keys & signing transactions', 'A mining rig'], a: 2 },
  { q: 'What makes a transaction "on-chain" trustworthy?', o: ['A company promises it', 'It is publicly verifiable and immutable on the ledger', 'It uses HTTPS', 'It is password protected'], a: 1 }
];

let provider, signer, account, contract, readContract;
let idx = 0, correct = 0, answered = false;

const $ = (id) => document.getElementById(id);
const short = (a) => a.slice(0, 6) + '…' + a.slice(-4);

$('contractLink').href = CONFIG.EXPLORER + '/address/' + CONFIG.CONTRACT_ADDRESS;
$('contractLink').textContent = CONFIG.CONTRACT_ADDRESS;

async function ensureNetwork() {
  const chainId = await provider.send('eth_chainId', []);
  if (parseInt(chainId, 16) === CONFIG.CHAIN_ID) return true;
  try {
    await provider.send('wallet_switchEthereumChain', [{ chainId: CONFIG.CHAIN_ID_HEX }]);
  } catch (e) {
    if (e.code === 4902 || /unrecognized|unknown/i.test(e.message || '')) {
      await provider.send('wallet_addEthereumChain', [{
        chainId: CONFIG.CHAIN_ID_HEX,
        chainName: CONFIG.CHAIN_NAME,
        rpcUrls: [CONFIG.RPC_URL],
        blockExplorerUrls: [CONFIG.EXPLORER],
        nativeCurrency: { name: CONFIG.CURRENCY, symbol: CONFIG.CURRENCY, decimals: 18 }
      }]);
    } else throw e;
  }
  return true;
}

async function connect(silent) {
  if (typeof ethers === 'undefined') { if (!silent) $('homeStatus').textContent = 'Library failed to load — refresh the page.'; return; }
  if (!window.ethereum) { if (!silent) $('homeStatus').textContent = 'No wallet found. Install MetaMask or a compatible wallet.'; return; }
  try {
    provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
    const accounts = silent
      ? await provider.send('eth_accounts', [])
      : await provider.send('eth_requestAccounts', []);
    if (!accounts || !accounts.length) return;
    await ensureNetwork();
    signer = provider.getSigner();
    account = await signer.getAddress();
    contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONFIG.ABI, signer);
    $('connectBtn').textContent = short(account);
    $('connectBtn').classList.add('ghost');
    $('disconnectBtn').classList.remove('hidden');
    $('netBadge').textContent = 'BOT Chain · 677';
    loadLeaderboard();
    loadMyStats();
  } catch (e) {
    if (!silent) $('homeStatus').textContent = 'Connection failed: ' + (e.message || e);
  }
}

function disconnect() {
  if (window.ethereum && window.ethereum.request) {
    window.ethereum.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }).catch(() => {});
  }
  provider = signer = account = contract = null;
  $('connectBtn').textContent = 'Connect Wallet';
  $('connectBtn').classList.remove('ghost');
  $('disconnectBtn').classList.add('hidden');
  $('netBadge').textContent = 'not connected';
  $('statsCard').classList.add('hidden');
  $('homeStatus').textContent = 'Wallet disconnected.';
  loadLeaderboard();
}

async function loadLeaderboard() {
  try {
    if (!readContract) {
      const p = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
      readContract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONFIG.ABI, p);
    }
    const [players, scores, totals] = await readContract.getLeaderboard();
    const rows = [];
    for (let i = 0; i < 10; i++) {
      if (players[i] === ethers.constants.AddressZero) continue;
      const me = account && players[i].toLowerCase() === account.toLowerCase() ? ' (you)' : '';
      rows.push(`<tr><td>${i + 1}</td><td class="mono"><a target="_blank" href="${CONFIG.EXPLORER}/address/${players[i]}">${short(players[i])}</a>${me}</td><td>${scores[i]} / ${totals[i]}</td></tr>`);
    }
    $('lbBody').innerHTML = rows.length ? rows.join('') : '<tr><td colspan="3" style="color:var(--dim)">No scores yet — be the first!</td></tr>';
  } catch (e) {
    $('lbBody').innerHTML = '<tr><td colspan="3" style="color:var(--dim)">Could not load leaderboard.</td></tr>';
  }
}

async function loadMyStats() {
  if (!contract || !account) return;
  try {
    const s = await contract.getStats(account);
    $('statsCard').classList.remove('hidden');
    $('myStats').innerHTML =
      `Best score: <b style="color:var(--txt)">${s.best} / ${s.bestOf}</b> · Games played: <b style="color:var(--txt)">${s.games}</b>` +
      (s.last.toNumber() ? ` · Last played: ${new Date(s.last.toNumber() * 1000).toLocaleString()}` : '');
  } catch (e) { /* ignore */ }
}

function startQuiz() {
  idx = 0; correct = 0;
  $('homeCard').classList.add('hidden');
  $('resultCard').classList.add('hidden');
  $('quizCard').classList.remove('hidden');
  $('qProgress').innerHTML = QUESTIONS.map((_, i) => `<span id="p${i}"></span>`).join('');
  renderQ();
}

function renderQ() {
  answered = false;
  const q = QUESTIONS[idx];
  $('qNum').textContent = `Question ${idx + 1} of ${QUESTIONS.length}`;
  $('qText').textContent = q.q;
  $('qStatus').textContent = '';
  for (let i = 0; i < QUESTIONS.length; i++) {
    $('p' + i).className = i < idx ? 'done' : i === idx ? 'cur' : '';
  }
  $('qOpts').innerHTML = '';
  q.o.forEach((opt, i) => {
    const b = document.createElement('button');
    b.className = 'opt';
    b.textContent = opt;
    b.onclick = () => pick(i, b);
    $('qOpts').appendChild(b);
  });
}

function pick(i, btn) {
  if (answered) return;
  answered = true;
  const q = QUESTIONS[idx];
  const opts = $('qOpts').children;
  for (const o of opts) o.disabled = true;
  if (i === q.a) { btn.classList.add('correct'); correct++; $('qStatus').textContent = '✅ Correct!'; }
  else { btn.classList.add('wrong'); opts[q.a].classList.add('correct'); $('qStatus').textContent = '❌ Wrong — correct answer highlighted.'; }
  setTimeout(() => {
    idx++;
    if (idx < QUESTIONS.length) renderQ(); else showResult();
  }, 1100);
}

function showResult() {
  $('quizCard').classList.add('hidden');
  $('resultCard').classList.remove('hidden');
  $('finalScore').textContent = `${correct} / ${QUESTIONS.length}`;
  const pct = correct / QUESTIONS.length;
  $('verdict').textContent = pct === 1 ? 'Flawless. Absolute blockchain brain. 🏆' :
    pct >= 0.6 ? 'Solid run — record it on-chain!' : 'Not bad — record it and try again!';
  $('txStatus').textContent = '';
}

async function recordScore() {
  if (!signer || !contract) { $('txStatus').textContent = 'Connect your wallet first.'; await connect(); if (!contract) return; }
  try {
    await ensureNetwork();
    $('recordBtn').disabled = true;
    $('txStatus').textContent = 'Sending transaction…';
    const gasPrice = await provider.getGasPrice();
    const tx = await contract.submitScore(correct, QUESTIONS.length, { gasPrice });
    $('txStatus').innerHTML = `Confirming… <a target="_blank" href="${CONFIG.EXPLORER}/tx/${tx.hash}">view on BOTScan</a>`;
    await tx.wait();
    $('txStatus').innerHTML = `✅ Score recorded on BOT Chain! <a target="_blank" href="${CONFIG.EXPLORER}/tx/${tx.hash}">view tx</a>`;
    loadLeaderboard();
    loadMyStats();
  } catch (e) {
    $('txStatus').textContent = 'Transaction failed: ' + (e.reason || e.message || e);
  } finally {
    $('recordBtn').disabled = false;
  }
}

$('connectBtn').onclick = () => { if (!account) connect(); };
$('disconnectBtn').onclick = disconnect;
$('startBtn').onclick = () => { if (!account) { $('homeStatus').textContent = 'Tip: connect your wallet so you can save your score on-chain.'; } startQuiz(); };
$('againBtn').onclick = startQuiz;
$('recordBtn').onclick = recordScore;
$('howBtn').onclick = () => { $('homeStatus').innerHTML = 'Play 8 questions → get your score → record it in one BOT Chain transaction → climb the leaderboard. Everything is verified on <a target="_blank" href="' + CONFIG.EXPLORER + '">BOTScan</a>.'; };

if (window.ethereum) {
  window.ethereum.on('accountsChanged', () => location.reload());
  window.ethereum.on('chainChanged', () => location.reload());
}
if (typeof ethers !== 'undefined') loadLeaderboard();
if (window.ethereum && typeof ethers !== 'undefined') connect(true);
