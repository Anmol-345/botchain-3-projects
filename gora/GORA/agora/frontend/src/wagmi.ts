import { createConfig, http } from 'wagmi'
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors'
import { defineChain, fallback } from 'viem'
import { config } from './config'

/**
 * Chain definitions.
 *
 *   31337  → Anvil (local dev)
 *   968    → BOT Chain Bohr testnet
 *   677    → BOT Chain mainnet
 */

const anvil = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: config.rpcUrls } },
})

const botchainMainnet = defineChain({
  id: 677,
  name: 'BOT Chain',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: config.rpcUrls } },
  blockExplorers: {
    default: { name: 'BOTScan', url: 'https://scan.botchain.ai' },
  },
})

const botchainBohr = defineChain({
  id: 968,
  name: 'BOT Chain Bohr Testnet',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: config.rpcUrls } },
  blockExplorers: {
    default: { name: 'BOTScan (Testnet)', url: 'https://scan.bohr.life' },
  },
  testnet: true,
})

function pickChain(chainId: number) {
  switch (chainId) {
    case 31337: return anvil
    case 968:   return botchainBohr
    case 677:   return botchainMainnet
    default:
      throw new Error(
        `Unsupported VITE_CHAIN_ID=${chainId}. Expected 31337 (anvil), 968 (Bohr) or 677 (BOT Chain).`,
      )
  }
}

export const chain = pickChain(config.chainId)

/** Resilient transport: falls over to the next RPC if one misbehaves. */
export const transport = fallback(
  config.rpcUrls.map((url) => http(url, { retryCount: 2, timeout: 15_000 })),
)

/**
 * WalletConnect project ID.
 * For production use, register a project at https://cloud.reown.com and set
 * VITE_WALLETCONNECT_PROJECT_ID in your .env file.
 * The fallback ID below is a public demo key — replace it for production.
 */
const wcProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? 'b56e18d47c72ab683b10814fe9495694'

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors: [
    injected(),
    walletConnect({
      projectId: wcProjectId,
      metadata: {
        name: 'GORA',
        description: 'A shared vault whose members are public — but not who acts.',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://gora.app',
        icons: ['https://gora.app/icon.png'],
      },
      showQrModal: true,
    }),
    coinbaseWallet({
      appName: 'GORA',
      appLogoUrl: 'https://gora.app/icon.png',
    }),
  ],
  transports: { [chain.id]: transport } as never,
})
