const ABI = [
  "function postCount() view returns (uint256)",
  "function posts(uint256) view returns (address creator, string title, string preview, uint256 price, uint64 duration, uint64 createdAt, bool active)",
  "function createPost(string title, string preview, string body, uint256 price, uint64 duration) returns (uint256)",
  "function updatePost(uint256 postId, string title, string preview, string body, uint256 price, uint64 duration, bool active)",
  "function purchaseAccess(uint256 postId) payable",
  "function hasAccess(uint256 postId, address user) view returns (bool)",
  "function accessExpiryOf(uint256 postId, address user) view returns (uint64)",
  "function getContent(uint256 postId) view returns (string)"
];

let provider, signer, account, contract;

const $ = (id) => document.getElementById(id);
const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function setStatus(el, type, msg) {
  el.className = "status show " + type;
  el.innerHTML = msg;
}
function txLink(hash) {
  return `<a href="${CONFIG.EXPLORER}/tx/${hash}" target="_blank" rel="noopener">View on BOTScan</a>`;
}
function fmtDuration(sec) {
  sec = Number(sec);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return d + " day" + (d > 1 ? "s" : "");
  if (h > 0) return h + " hour" + (h > 1 ? "s" : "");
  if (m > 0) return m + " min" + (m > 1 ? "s" : "");
  return sec + " sec";
}
function fmtExpiry(ts) {
  return new Date(Number(ts) * 1000).toLocaleString();
}
function closeModal(id) { $(id).classList.remove("open"); }

async function ensureNetwork() {
  const chainId = await provider.send("eth_chainId", []);
  if (chainId === CONFIG.CHAIN_ID_HEX) return true;
  try {
    await provider.send("wallet_switchEthereumChain", [{ chainId: CONFIG.CHAIN_ID_HEX }]);
    return true;
  } catch (e) {
    if (e.code === 4902 || (e.data && e.data.originalError && e.data.originalError.code === 4902)) {
      await provider.send("wallet_addEthereumChain", [{
        chainId: CONFIG.CHAIN_ID_HEX,
        chainName: CONFIG.CHAIN_NAME,
        rpcUrls: [CONFIG.RPC_URL],
        nativeCurrency: { name: CONFIG.CURRENCY, symbol: CONFIG.CURRENCY, decimals: 18 },
        blockExplorerUrls: [CONFIG.EXPLORER]
      }]);
      return true;
    }
    throw e;
  }
}

async function connect() {
  if (!window.ethereum) { setStatus($("netStatus"), "err", "No wallet found. Please install MetaMask or a compatible wallet."); return; }
  provider = new ethers.providers.Web3Provider(window.ethereum, "any");
  await provider.send("eth_requestAccounts", []);
  try { await ensureNetwork(); } catch (e) { setStatus($("netStatus"), "err", "Please switch to BOT Chain (Chain ID 677)."); return; }
  signer = provider.getSigner();
  account = await signer.getAddress();
  contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, ABI, signer);
  localStorage.removeItem("askas_dc");
  $("walletInfo").textContent = short(account);
  $("connectBtn").textContent = "Disconnect";
  $("connectBtn").onclick = disconnect;
  setStatus($("netStatus"), "ok", "Connected to BOT Chain Mainnet.");
  setTimeout(() => $("netStatus").classList.remove("show"), 3000);
  await loadPosts();
}

async function disconnect() {
  localStorage.setItem("askas_dc", "1");
  if (window.ethereum && window.ethereum.request) {
    try {
      await window.ethereum.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
    } catch (e) {
      console.warn("Wallet does not support revoke; clearing in-app session only.", e);
    }
  }
  location.reload();
}

async function loadPosts() {
  const grid = $("postsGrid");
  grid.innerHTML = '<div class="empty">Loading…</div>';
  const count = (await contract.postCount()).toNumber();
  if (count === 0) { grid.innerHTML = '<div class="empty">No content yet. Be the first creator to publish.</div>'; return; }
  const items = [];
  for (let i = count - 1; i >= 0; i--) {
    const p = await contract.posts(i);
    if (!p.active) continue;
    const access = account ? await contract.hasAccess(i, account) : false;
    const expiry = account ? await contract.accessExpiryOf(i, account) : 0;
    const mine = account && p.creator.toLowerCase() === account.toLowerCase();
    items.push({ id: i, p, access, expiry, mine });
  }
  if (!items.length) { grid.innerHTML = '<div class="empty">No active content right now.</div>'; return; }
  grid.innerHTML = "";
  for (const { id, p, access, expiry, mine } of items) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${esc(p.title)}</h3>
      <div class="preview">${esc(p.preview || "")}</div>
      <div class="meta">
        <span class="price">${ethers.utils.formatEther(p.price)} BOT</span>
        <span>${fmtDuration(p.duration)} access</span>
        <span>Post #${id}</span>
      </div>
      <div class="creator">Creator: ${esc(p.creator)}</div>
      <div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;gap:10px">
        ${mine
          ? '<span class="access-ok">✓ Your post — full access</span>'
          : access
            ? `<span class="access-ok">✓ Access until ${fmtExpiry(expiry)}</span>`
            : `<button class="btn small" data-buy="${id}" data-price="${p.price.toString()}">Unlock for ${ethers.utils.formatEther(p.price)} BOT</button>`}
      </div>
      <div class="content-body" id="body-${id}"></div>
      ${access ? `<div style="margin-top:10px"><button class="btn ghost small" data-read="${id}">View Content</button></div>` : ""}
    `;
    grid.appendChild(card);
  }
  grid.querySelectorAll("[data-buy]").forEach((b) => b.onclick = () => buy(Number(b.dataset.buy), b.dataset.price, b));
  grid.querySelectorAll("[data-read]").forEach((b) => b.onclick = () => readContent(Number(b.dataset.read), b));
}

async function buy(postId, priceWei, btn) {
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = "Confirm in wallet…";
  try {
    const gasPrice = await provider.getGasPrice();
    const tx = await contract.purchaseAccess(postId, { value: priceWei, gasPrice });
    btn.textContent = "Processing…";
    await tx.wait();
    btn.textContent = "✓ Unlocked";
    setTimeout(loadPosts, 1200);
  } catch (e) {
    btn.disabled = false;
    btn.textContent = orig;
    alert("Purchase failed: " + (e.reason || e.message));
  }
}

async function readContent(postId, btn) {
  btn.disabled = true;
  try {
    // call with explicit from so the contract sees our address for the access check
    const body = await contract.callStatic.getContent(postId, { from: account });
    const el = $("body-" + postId);
    el.textContent = body;
    el.style.display = "block";
    btn.textContent = "Hide Content";
    btn.disabled = false;
    btn.onclick = () => { el.style.display = "none"; btn.textContent = "View Content"; btn.onclick = () => readContent(postId, btn); };
  } catch (e) {
    btn.disabled = false;
    alert("Could not read content: " + (e.reason || e.message));
  }
}

async function publish() {
  const title = $("pTitle").value.trim();
  const preview = $("pPreview").value.trim();
  const body = $("pBody").value.trim();
  const price = $("pPrice").value;
  const duration = Number($("pDuration").value);
  const st = $("pubStatus");
  if (!title || !body || price === "" || Number(price) < 0) {
    setStatus(st, "err", "Please fill in title, content and a valid price.");
    return;
  }
  const btn = $("publishSubmit");
  btn.disabled = true;
  setStatus(st, "info", "Confirm the transaction in your wallet…");
  try {
    const gasPrice = await provider.getGasPrice();
    const tx = await contract.createPost(title, preview, body, ethers.utils.parseEther(price), duration, { gasPrice });
    setStatus(st, "info", `Transaction submitted. ${txLink(tx.hash)}`);
    await tx.wait();
    setStatus(st, "ok", `Published! ${txLink(tx.hash)}`);
    setTimeout(() => { closeModal("publishModal"); loadPosts(); }, 1500);
  } catch (e) {
    setStatus(st, "err", "Publish failed: " + esc(e.reason || e.message));
  }
  btn.disabled = false;
}

async function showMine() {
  const box = $("myContent");
  box.innerHTML = "Loading…";
  $("myModal").classList.add("open");
  const count = (await contract.postCount()).toNumber();
  let html = "";
  for (let i = count - 1; i >= 0; i--) {
    const p = await contract.posts(i);
    if (p.creator.toLowerCase() === account.toLowerCase()) {
      html += `<div class="card" style="margin-bottom:12px"><b>${esc(p.title)}</b>
        <div class="meta"><span class="price">${ethers.utils.formatEther(p.price)} BOT</span>
        <span>${fmtDuration(p.duration)}</span><span>${p.active ? "Active" : "Inactive"}</span></div>
        <div class="access-ok">You have full access (creator).</div></div>`;
    } else {
      const exp = await contract.accessExpiryOf(i, account);
      if (Number(exp) * 1000 > Date.now()) {
        html += `<div class="card" style="margin-bottom:12px"><b>${esc(p.title)}</b>
          <div class="access-ok" style="margin-top:8px">✓ Access until ${fmtExpiry(exp)}</div></div>`;
      }
    }
  }
  box.innerHTML = html || '<div class="empty">You have no posts or active access yet.</div>';
}

async function init() {
  if (!window.ethereum) {
    const ro = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
    contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, ABI, ro);
  } else {
    provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    const manuallyDisconnected = localStorage.getItem("askas_dc");
    if (!manuallyDisconnected) {
      try {
        const accounts = await provider.send("eth_accounts", []);
        if (accounts.length) {
          await ensureNetwork();
          signer = provider.getSigner();
          account = await signer.getAddress();
          contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, ABI, signer);
          $("walletInfo").textContent = short(account);
          $("connectBtn").textContent = "Disconnect";
          $("connectBtn").onclick = disconnect;
        } else {
          contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, ABI, provider);
        }
      } catch (e) {
        contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, ABI, provider);
      }
    } else {
      contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, ABI, provider);
      $("connectBtn").textContent = "Connect Wallet";
      $("connectBtn").onclick = connect;
    }
    window.ethereum.on("accountsChanged", () => location.reload());
    window.ethereum.on("chainChanged", () => location.reload());
  }
  await loadPosts();
}

$("connectBtn").onclick = connect;
$("publishBtn").onclick = () => {
  if (!account) { connect(); return; }
  $("pubStatus").className = "status";
  $("publishModal").classList.add("open");
};
$("myPostsBtn").onclick = () => { if (account) showMine(); else connect(); };
$("publishSubmit").onclick = publish;
$("contractLink").href = `${CONFIG.EXPLORER}/address/${CONFIG.CONTRACT_ADDRESS}`;
$("contractLink").textContent = CONFIG.CONTRACT_ADDRESS;

init();
