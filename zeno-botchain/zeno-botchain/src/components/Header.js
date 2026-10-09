import React from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { formatAddress, BOT_CHAIN_NAME } from "../constants";
import logo from "../logo.png";

const Header = () => {
  const { account, isConnected, isCorrectNetwork, connect, disconnect, switchNetwork } = useWallet();

  return (
    <div className="w-full z-20 fixed top-0">
      <div className="flex justify-between h-full items-center px-4 py-2">
        <div>
          <Link to="/" style={{ textDecoration: "none" }}>
            <img src={logo} alt="logo" className="h-16" />
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {isConnected && (
            <>
              {!isCorrectNetwork ? (
                <button
                  onClick={switchNetwork}
                  className="px-3 py-2 text-xs md:text-sm rounded-lg bg-red-600 text-white font-semibold shadow"
                >
                  Switch to {BOT_CHAIN_NAME}
                </button>
              ) : (
                <span className="px-3 py-1 text-xs md:text-sm rounded-full bg-green-600 text-white font-semibold shadow">
                  {BOT_CHAIN_NAME}
                </span>
              )}
              <img
                src={`https://avatars.dicebear.com/api/personas/${account}.svg`}
                alt="avatar"
                className="h-10 w-10 rounded-full shadow border-2 border-white"
              />
              <button
                onClick={disconnect}
                className="px-3 py-2 border border-black text-sm rounded-lg text-white cl-div2 font-semibold shadow"
              >
                {formatAddress(account)} · Disconnect
              </button>
            </>
          )}
          {!isConnected && (
            <button
              onClick={connect}
              className="px-4 py-2 bg-purple-700 text-sm rounded-lg text-white font-semibold shadow hover:bg-purple-800 transition"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;
