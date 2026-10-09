import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useSnackbar } from "notistack";
import {
  BOT_CHAIN_CHAIN_ID,
  BOT_CHAIN_RPC,
  BOT_CHAIN_NAME,
  BOT_CHAIN_NATIVE_CURRENCY,
  BOT_CHAIN_HEX_CHAIN_ID,
  BOT_CHAIN_EXPLORER,
} from "../constants";

const WalletContext = createContext();

export const useWallet = () => useContext(WalletContext);

const MANUAL_DISCONNECT_KEY = "zeno-manual-disconnect";

const networkParams = {
  chainId: BOT_CHAIN_HEX_CHAIN_ID,
  chainName: BOT_CHAIN_NAME,
  nativeCurrency: { name: BOT_CHAIN_NATIVE_CURRENCY, symbol: BOT_CHAIN_NATIVE_CURRENCY, decimals: 18 },
  rpcUrls: [BOT_CHAIN_RPC],
  blockExplorerUrls: [BOT_CHAIN_EXPLORER],
};

export const WalletProvider = ({ children }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState("0");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [manualDisconnect, setManualDisconnect] = useState(
    () => localStorage.getItem(MANUAL_DISCONNECT_KEY) === "true"
  );

  const clearState = useCallback(() => {
    setAccount(null);
    setSigner(null);
    setBalance("0");
  }, []);

  const refreshBalance = useCallback(async (addr, prov) => {
    if (!addr || !prov) return;
    try {
      const bal = await prov.getBalance(addr);
      setBalance(ethers.utils.formatEther(bal));
    } catch {
      setBalance("0");
    }
  }, []);

  const handleAccountsChanged = useCallback(
    async (accounts) => {
      if (manualDisconnect) return;
      if (!accounts || accounts.length === 0) {
        clearState();
        return;
      }
      const addr = accounts[0];
      setAccount(addr);
      const prov = new ethers.providers.Web3Provider(window.ethereum, "any");
      setProvider(prov);
      setSigner(prov.getSigner());
      await refreshBalance(addr, prov);
    },
    [manualDisconnect, refreshBalance, clearState]
  );

  const handleChainChanged = useCallback(
    async (cid) => {
      const id = Number(cid);
      setChainId(id);
      if (window.ethereum) {
        const prov = new ethers.providers.Web3Provider(window.ethereum, "any");
        setProvider(prov);
        if (account && !manualDisconnect) {
          setSigner(prov.getSigner());
          await refreshBalance(account, prov);
        }
      }
    },
    [account, manualDisconnect, refreshBalance]
  );

  useEffect(() => {
    if (!window.ethereum) return;

    const onAccounts = (accounts) => handleAccountsChanged(accounts);
    const onChain = (cid) => handleChainChanged(cid);

    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);

    window.ethereum.request({ method: "eth_chainId" }).then(onChain);
    if (!manualDisconnect) {
      window.ethereum.request({ method: "eth_accounts" }).then(onAccounts);
    }

    return () => {
      if (window.ethereum && window.ethereum.removeListener) {
        window.ethereum.removeListener("accountsChanged", onAccounts);
        window.ethereum.removeListener("chainChanged", onChain);
      }
    };
  }, [handleAccountsChanged, handleChainChanged, manualDisconnect]);

  useEffect(() => {
    if (!account || !provider) return;
    const id = setInterval(() => refreshBalance(account, provider), 15000);
    return () => clearInterval(id);
  }, [account, provider, refreshBalance]);

  const isCorrectNetwork = chainId === BOT_CHAIN_CHAIN_ID;

  const requestWalletPermission = async () => {
    if (!window.ethereum || !window.ethereum.request) return;
    try {
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch (err) {
      if (err.code === -32601 || err.code === 4001) throw err;
      console.warn("wallet_requestPermissions not supported or rejected", err);
    }
  };

  const connect = async () => {
    if (!window.ethereum) {
      enqueueSnackbar("MetaMask not detected. Please install MetaMask.", { variant: "error" });
      return;
    }
    try {
      setIsConnecting(true);
      setManualDisconnect(false);
      localStorage.removeItem(MANUAL_DISCONNECT_KEY);

      await requestWalletPermission();

      const prov = new ethers.providers.Web3Provider(window.ethereum, "any");
      await prov.send("eth_requestAccounts", []);
      const network = await prov.getNetwork();
      setChainId(network.chainId);
      const signer = prov.getSigner();
      const addr = await signer.getAddress();
      setAccount(addr);
      setProvider(prov);
      setSigner(signer);
      await refreshBalance(addr, prov);
      if (network.chainId !== BOT_CHAIN_CHAIN_ID) {
        enqueueSnackbar("Please switch to the BOT Chain network.", { variant: "warning" });
      }
    } catch (err) {
      console.error(err);
      if (err?.code !== 4001) {
        enqueueSnackbar(err?.message || "Failed to connect wallet", { variant: "error" });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const switchNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BOT_CHAIN_HEX_CHAIN_ID }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [networkParams],
          });
        } catch (addError) {
          enqueueSnackbar("Could not add BOT Chain network", { variant: "error" });
        }
      } else {
        console.error(switchError);
      }
    }
  };

  const revokeWalletPermission = async () => {
    if (!window.ethereum || !window.ethereum.request) return;
    try {
      await window.ethereum.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch (err) {
      console.warn("wallet_revokePermissions not supported or failed", err);
    }
  };

  const disconnect = async () => {
    setManualDisconnect(true);
    localStorage.setItem(MANUAL_DISCONNECT_KEY, "true");
    clearState();
    setChainId(null);
    setProvider(null);
    await revokeWalletPermission();
    enqueueSnackbar("Wallet disconnected", { variant: "info", autoHideDuration: 1500 });
  };

  const value = {
    account,
    chainId,
    balance,
    provider,
    signer,
    isConnecting,
    isConnected: !!account,
    isCorrectNetwork,
    connect,
    disconnect,
    switchNetwork,
    refreshBalance: () => refreshBalance(account, provider),
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
