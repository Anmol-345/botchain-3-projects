import React, { useState } from "react";
import { ethers } from "ethers";
import { useSnackbar } from "notistack";
import { useWallet } from "../../context/WalletContext";
import ZenoPayment from "../../abi/ZenoPayment.json";
import { ZENO_PAYMENT_ADDRESS, BOT_CHAIN_NAME, explorerLink } from "../../constants";
import Loader from "../../components/Loader";

const Payment = () => {
  const { account, signer, balance, isConnected, isCorrectNetwork, switchNetwork, refreshBalance, provider } = useWallet();
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState({ to: "", amount: "", memo: "" });
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!signer || !isConnected || !isCorrectNetwork) {
      await switchNetwork();
      return;
    }
    if (!form.to || !ethers.utils.isAddress(form.to)) {
      enqueueSnackbar("Please enter a valid BOT Chain address", { variant: "error" });
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      enqueueSnackbar("Amount must be greater than 0", { variant: "error" });
      return;
    }

    let value;
    try {
      value = ethers.utils.parseEther(form.amount);
    } catch {
      enqueueSnackbar("Invalid amount", { variant: "error" });
      return;
    }

    const balanceWei = ethers.utils.parseEther(balance || "0");
    const gasBuffer = ethers.utils.parseEther("0.001");
    if (balanceWei.lt(value.add(gasBuffer))) {
      enqueueSnackbar("Insufficient BOT balance (keep ~0.001 BOT for gas)", { variant: "error" });
      return;
    }

    setLoading(true);
    setTxHash("");
    try {
      const contract = new ethers.Contract(ZENO_PAYMENT_ADDRESS, ZenoPayment, signer);
      const gasPrice = await provider.getGasPrice();
      const tx = await contract.pay(form.to, form.memo || "BOT transfer", {
        value,
        gasPrice,
      });
      await tx.wait();
      setTxHash(tx.hash);
      enqueueSnackbar("Payment sent successfully!", { variant: "success" });
      setForm({ to: "", amount: "", memo: "" });
      refreshBalance();

      const record = {
        hash: tx.hash,
        from: account,
        to: form.to,
        amount: form.amount,
        memo: form.memo || "BOT transfer",
        timestamp: Date.now(),
      };
      const key = `zeno-history-${account}`;
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      localStorage.setItem(key, JSON.stringify([record, ...existing].slice(0, 50)));
    } catch (err) {
      console.error(err);
      enqueueSnackbar(err?.message || "Transaction failed", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-center mt-8 md:mt-20 px-3">
        <div className="cl-div2 rounded-2xl shadow-xl w-full md:w-1/2 px-6 py-8">
          <h2 className="text-2xl font-bold text-white text-center mb-2">Send BOT</h2>
          <p className="text-center text-white/80 text-sm mb-6">Native BOT transfer on {BOT_CHAIN_NAME}</p>

          <div className="flex justify-between items-center mb-6 bg-white/10 rounded-lg px-4 py-2">
            <span className="text-white/80 text-sm">Wallet balance</span>
            <span className="text-white font-semibold">{Number(balance).toFixed(4)} BOT</span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="text-white font-medium text-sm">Recipient address</label>
              <input
                type="text"
                required
                value={form.to}
                onChange={(e) => setForm({ ...form, to: e.target.value })}
                placeholder="0x..."
                className="w-full mt-2 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            <div className="mb-4">
              <label className="text-white font-medium text-sm">Amount (BOT)</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                className="w-full mt-2 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            <div className="mb-6">
              <label className="text-white font-medium text-sm">Memo (optional)</label>
              <input
                type="text"
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
                placeholder="e.g. Invoice #123"
                className="w-full mt-2 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-3 bg-purple-700 hover:bg-purple-800 text-white font-semibold shadow transition disabled:opacity-70 flex justify-center items-center"
            >
              {loading ? <Loader size="sm" /> : isCorrectNetwork ? "Send BOT" : `Switch to ${BOT_CHAIN_NAME}`}
            </button>
          </form>

          {txHash && (
            <div className="mt-6 bg-white/10 rounded-lg p-4 text-center">
              <p className="text-white text-sm mb-1">Transaction confirmed</p>
              <a
                href={explorerLink(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-200 text-sm underline break-all"
              >
                View on explorer: {txHash.slice(0, 18)}...
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Payment;
