export const ZENO_PAYMENT_ADDRESS = process.env.REACT_APP_ZENO_PAYMENT_ADDRESS;
export const BOT_CHAIN_RPC = process.env.REACT_APP_BOT_CHAIN_RPC;
export const BOT_CHAIN_CHAIN_ID = Number(process.env.REACT_APP_BOT_CHAIN_CHAIN_ID);
export const BOT_CHAIN_HEX_CHAIN_ID = process.env.REACT_APP_BOT_CHAIN_HEX_CHAIN_ID;
export const BOT_CHAIN_NAME = process.env.REACT_APP_BOT_CHAIN_NAME;
export const BOT_CHAIN_EXPLORER = process.env.REACT_APP_BOT_CHAIN_EXPLORER;
export const BOT_CHAIN_NATIVE_CURRENCY = process.env.REACT_APP_BOT_CHAIN_NATIVE_CURRENCY;

export const networkParams = {
  chainId: BOT_CHAIN_HEX_CHAIN_ID,
  chainName: BOT_CHAIN_NAME,
  nativeCurrency: {
    name: BOT_CHAIN_NATIVE_CURRENCY,
    symbol: BOT_CHAIN_NATIVE_CURRENCY,
    decimals: 18,
  },
  rpcUrls: [BOT_CHAIN_RPC],
  blockExplorerUrls: [BOT_CHAIN_EXPLORER],
};

export const formatAddress = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

export const explorerLink = (hash) => `${BOT_CHAIN_EXPLORER}/tx/${hash}`;
