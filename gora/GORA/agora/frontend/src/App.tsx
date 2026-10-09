import { useState, useEffect, useRef } from 'react'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'

import { config } from './config'
import { chain } from './wagmi'
import { shortAddr } from './lib/chain'
import Organigramme from './screens/Organigramme'
import Nommer from './screens/Nommer'
import MonPoste from './screens/MonPoste'
import Signer from './screens/Signer'
import Defi from './screens/Defi'
import IntroScreen from './screens/IntroScreen'
import HowToUse from './screens/HowToUse'

const SCREENS = [
  { id: 'organigramme', label: '1 · Organization' },
  { id: 'nommer', label: '2 · Appoint' },
  { id: 'poste', label: '3 · My Role' },
  { id: 'signer', label: '4 · Sign' },
  { id: 'defi', label: '5 · The Challenge' },
  { id: 'howto', label: '0 · How to Use' },
] as const

type ScreenId = (typeof SCREENS)[number]['id']

export default function App() {
  const [introFinished, setIntroFinished] = useState(false)
  const [dimMenu, setDimMenu] = useState(false)
  const [screen, setScreen] = useState<ScreenId>('organigramme')
  const [showConnectors, setShowConnectors] = useState(false)
  const { address, isConnected, chainId } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: switching } = useSwitchChain()

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Close connector dropdown when clicking outside
  useEffect(() => {
    if (!showConnectors) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-connector-menu]')) setShowConnectors(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showConnectors])

  const activeIndex = SCREENS.findIndex(s => s.id === screen)

  // Garde-fou réseau : sans lui, le wallet peut envoyer une transaction sur le
  // MAINNET où aucun de nos contrats n'existe. Vu en conditions réelles.
  const wrongChain = isConnected && chainId !== undefined && chainId !== chain.id
  const writeScreen = screen === 'nommer' || screen === 'poste' || screen === 'signer'

  // Reset scroll position of content when screen changes or when intro finishes
  useEffect(() => {
    document.body.style.overflow = 'auto'
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [screen, introFinished])

  return (
    <div className="relative min-h-screen bg-[#050810]">
      {/* 
        Header is always visible (wallet button), but GORA title only appears when intro is finished
      */}
      <header className="fixed top-0 left-0 w-full p-6 z-50 pointer-events-auto flex items-center justify-between">
        <div className={`transition-opacity duration-1000 ${introFinished ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <h1 className="text-white/90 font-light tracking-[0.4em] text-xl ml-2">GORA</h1>
        </div>

        <div className="relative" data-connector-menu>
          {!isConnected ? (
            <>
              <button 
                onClick={() => setShowConnectors(v => !v)}
                className="px-4 py-2 border rounded-full transition-all duration-500 backdrop-blur-md text-sm tracking-wide whitespace-nowrap shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,245,190,0.7)] hover:scale-105 bg-white/5 border-white/20 text-white/70 hover:bg-white/20 hover:text-white hover:border-white/80"
              >
                Connect Wallet
              </button>
              {showConnectors && (
                <div className="absolute right-0 top-12 z-50 bg-[#0a0f1a] border border-white/20 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden min-w-[200px]">
                  {connectors.map((connector) => (
                    <button
                      key={connector.uid}
                      onClick={() => { connect({ connector }); setShowConnectors(false) }}
                      className="w-full text-left px-5 py-3 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-3 border-b border-white/5 last:border-0"
                    >
                      <span className="text-white/40 text-xs w-4">
                        {connector.name === 'MetaMask' || connector.name === 'Injected' ? '🦊' :
                         connector.name.includes('WalletConnect') ? '🔗' :
                         connector.name.includes('Coinbase') ? '🔵' : '👛'}
                      </span>
                      {connector.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <button
              onClick={() => disconnect()}
              className="px-4 py-2 border rounded-full transition-all duration-500 backdrop-blur-md text-sm tracking-wide whitespace-nowrap shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,245,190,0.7)] hover:scale-105 bg-white/5 border-white/20 text-white/70 hover:bg-white/20 hover:text-white hover:border-white/80"
              title="Disconnect"
            >
              {shortAddr(address!)} ✕
            </button>
          )}
        </div>
      </header>

      {/* 
        IntroScreen acts as the persistent starry background and top navigation. 
        It fills the screen and handles the scroll animations.
      */}
      <IntroScreen 
        onMenuReady={(isReady) => setIntroFinished(isReady)} 
        onCategorySelect={(index) => setScreen(SCREENS[index].id)}
        activeCategoryIndex={activeIndex}
        dimMenu={dimMenu}
      />

      {/* 
        The main App content overlay. 
        It fades in and slides up once the IntroScreen menu reaches the top.
      */}
      <div 
        className={`fixed inset-0 z-20 pointer-events-none transition-all duration-1000 flex flex-col ${
          introFinished ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}
      >
        {/* Empty space that lets clicks pass through to the 3D menu behind it. Reduced to h-32 since menu is higher */}
        <div className="h-32 shrink-0 pointer-events-none" />

        {/* Scrollable area for the app content. */}
        <div 
          ref={scrollContainerRef}
          className={`${introFinished ? 'pointer-events-auto' : 'pointer-events-none'} flex-1 w-full overflow-y-auto bg-transparent`}
          onScroll={(e) => setDimMenu(e.currentTarget.scrollTop > 50)}
        >
          {wrongChain && (
            <div className="mx-auto max-w-5xl px-6 mt-4">
              <div className="border-l-2 border-red-500/50 bg-red-500/5 px-4 py-3 flex flex-wrap items-center gap-3 backdrop-blur-md">
                <span className="text-sm text-red-200/80">
                  ⚠️ Your wallet is on the <strong className="text-red-200 font-medium">wrong network</strong> (chainId {chainId}). GORA
                  contracts are on <strong className="text-red-200 font-medium">{chain.name}</strong> — signing here would send the
                  transaction into the void.
                </span>
                <button
                  disabled={switching}
                  onClick={() => switchChain({ chainId: chain.id })}
                  className="px-4 py-1.5 rounded-full border border-red-500/30 bg-white/5 text-sm tracking-wide text-red-200 hover:bg-white/10 hover:border-red-400 transition-colors disabled:opacity-50"
                >
                  {switching ? 'switching…' : `Switch to ${chain.name}`}
                </button>
              </div>
            </div>
          )}

          <main className="px-6 pt-6 pb-24 max-w-5xl mx-auto font-sans font-light text-white/80">
            {wrongChain && writeScreen ? (
              <div className="border-l-2 border-white/20 bg-white/5 px-4 py-6 text-sm text-white/60 max-w-xl backdrop-blur-md">
                This screen signs transactions: it remains locked until your wallet is on{' '}
                <span className="text-white font-medium">{chain.name}</span>. Use the red button above.
              </div>
            ) : (
              <>
                {screen === 'organigramme' && <Organigramme />}
                {screen === 'nommer' && <Nommer />}
                {screen === 'poste' && <MonPoste />}
                {screen === 'signer' && <Signer />}
                {screen === 'defi' && <Defi />}
                {screen === 'howto' && <HowToUse />}
              </>
            )}
          </main>

          {/* FOOTER */}
          <footer className="text-center text-white/60 text-xs p-8 border-t border-white/10 mt-8">
            <div className="text-[11px] tracking-[1.4px] uppercase mb-2">Ecosystem Partner</div>
            <div className="flex items-center justify-center gap-2 mb-4">
              <img src="/botchain-logo.jpeg" alt="BOT Chain logo" className="w-6 h-6 rounded" />
              <span className="text-white/90 font-semibold text-sm">BOT Chain</span>
            </div>
            <div className="flex justify-center gap-5 flex-wrap mb-4">
              <a href="https://botchain.ai" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white transition-colors">BOT Chain Official Website</a>
              <a href="https://scan.botchain.ai" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white transition-colors">BOT Chain Explorer</a>
            </div>
            <div className="mt-5 opacity-80">
              GORA on BOT Chain · Contract: <a href={`https://scan.botchain.ai/address/${config.vault}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white transition-colors">{shortAddr(config.vault)}</a> · Powered by BOT Chain Mainnet (Chain ID 677)
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
