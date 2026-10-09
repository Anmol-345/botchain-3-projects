import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import './index.css'
import { wagmiConfig } from './wagmi'
import { SessionProvider } from './session'
import { ErrorBoundary } from './ErrorBoundary'
import App from './App'

const queryClient = new QueryClient()

window.addEventListener('unhandledrejection', (e) => {
  console.error('[GORA] promesse rejetée non gérée :', e.reason)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <App />
          </SessionProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  </StrictMode>,
)
