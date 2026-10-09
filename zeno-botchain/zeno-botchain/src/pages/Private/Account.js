import React from "react";
import { useSnackbar } from "notistack";
import { useWallet } from "../../context/WalletContext";
import { formatAddress, BOT_CHAIN_NAME, BOT_CHAIN_EXPLORER } from "../../constants";

const Account = () => {
  const { account, balance, isCorrectNetwork, chainId, disconnect } = useWallet();
  const { enqueueSnackbar } = useSnackbar();

  const copyAddress = () => {
    navigator.clipboard.writeText(account);
    enqueueSnackbar("Address copied", { variant: "success", autoHideDuration: 1500 });
  };

  return (
    <div className="md:px-6 px-3 py-6">
      <p className="text-center text-3xl font-bold mb-8">Account Details</p>
      <div className="flex flex-col items-center w-full">
        <div className="h-36 w-36 rounded-full shadow-lg border-4 border-white overflow-hidden bg-white">
          <img
            src={`https://avatars.dicebear.com/api/personas/${account}.svg`}
            alt="avatar"
            className="h-full w-full"
          />
        </div>
        <div className="mt-4 mx-2 w-full md:w-2/5">
          <button
            onClick={copyAddress}
            className="w-full text-sm md:text-base overflow-hidden text-white rounded-lg shadow font-semibold px-4 py-3 cl-div2 hover:opacity-90 transition"
          >
            {account}
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
        <div className="cl-div2 rounded-xl p-5 text-white shadow">
          <p className="text-white/70 text-sm">Network</p>
          <p className="text-xl font-semibold">{BOT_CHAIN_NAME}</p>
          <p className="text-xs text-white/70 mt-1">Chain ID: {chainId || "—"}</p>
        </div>
        <div className="cl-div2 rounded-xl p-5 text-white shadow">
          <p className="text-white/70 text-sm">Balance</p>
          <p className="text-2xl font-bold">{Number(balance).toFixed(4)} BOT</p>
        </div>
        <div className="cl-div2 rounded-xl p-5 text-white shadow">
          <p className="text-white/70 text-sm">Status</p>
          <p className={`text-lg font-semibold ${isCorrectNetwork ? "text-green-300" : "text-red-300"}`}>
            {isCorrectNetwork ? "Connected" : "Wrong network"}
          </p>
        </div>
        <div className="cl-div2 rounded-xl p-5 text-white shadow">
          <p className="text-white/70 text-sm">Explorer</p>
          <a
            href={BOT_CHAIN_EXPLORER}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-200 underline text-sm"
          >
            {BOT_CHAIN_EXPLORER.replace("https://", "")}
          </a>
        </div>
      </div>

      <div className="flex justify-center mt-8">
        <button
          onClick={disconnect}
          className="px-6 py-2 rounded-lg border border-red-500 text-red-600 font-semibold hover:bg-red-50 transition"
        >
          Disconnect Wallet
        </button>
      </div>
    </div>
  );
};

export default Account;
