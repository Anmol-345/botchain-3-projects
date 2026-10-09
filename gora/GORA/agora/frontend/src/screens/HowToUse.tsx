/**
 * Screen 0 — How to Use GORA.
 * A plain-English guide for organisations considering a mainnet deployment.
 */
import { config } from '../config'

export default function HowToUse() {
  const explorerBase = config.chainId === 677
    ? 'https://scan.botchain.ai'
    : config.chainId === 968
    ? 'https://scan.bohr.life'
    : null

  return (
    <div className="space-y-16 max-w-2xl text-sm text-white/70 leading-relaxed">
      <div>
        <h2 className="text-2xl font-light tracking-[0.2em] uppercase text-white/90 mb-4">How to Use GORA</h2>
        <p className="text-white/50 max-w-xl">
          GORA is a shared vault for organisations. Members are public. Who signs is not.
          Mandates expire automatically. No backend, no admin list — just ENS and math.
        </p>
      </div>

      {/* ── What you need ─────────────────────────────────────── */}
      <section className="space-y-4 border-l-2 border-white/10 pl-6">
        <h3 className="text-xs uppercase tracking-[0.2em] text-white/50 mb-3">What You Need</h3>
        <ul className="space-y-3">
          <li className="flex gap-3">
            <span className="text-white/30 shrink-0">1.</span>
            <span>A wallet on <strong className="text-white/80">BOT Chain</strong> (chain ID 677 for mainnet, 968 for Bohr testnet). Add it to MetaMask as a custom network.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-white/30 shrink-0">2.</span>
            <span>Some <strong className="text-white/80">BOT</strong> for gas. On testnet get it free from <a href="https://faucet.botchain.ai/basic" target="_blank" rel="noopener" className="text-white/60 underline hover:text-white transition-colors">faucet.botchain.ai</a>. On mainnet buy BOT on <a href="https://dex.botchain.ai" target="_blank" rel="noopener" className="text-white/60 underline hover:text-white transition-colors">B DEX</a>.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-white/30 shrink-0">3.</span>
            <span>Each member needs an <strong className="text-white/80">.eth name</strong> on this network. If they don't have one, they can register it for free (gas only) on the <em className="text-white/60 not-italic">My Role</em> screen.</span>
          </li>
        </ul>
      </section>

      {/* ── Step by step ──────────────────────────────────────── */}
      <section className="space-y-8">
        <h3 className="text-xs uppercase tracking-[0.2em] text-white/50">Step by Step</h3>

        <Step n="1" role="Admin" title="Deploy the vault">
          <p>Clone the repository and follow <span className="mono text-white/60">RUNBOOK.md</span>. Run two Foundry scripts:</p>
          <pre className="mt-3 bg-white/5 border border-white/10 rounded-lg p-4 text-xs mono text-white/60 overflow-x-auto whitespace-pre-wrap">{`forge script script/DeployENS.s.sol --rpc-url botchain --broadcast --slow
forge script script/SetupGora.s.sol  --rpc-url botchain --broadcast --slow`}</pre>
          <p className="mt-3">Copy the printed addresses into <span className="mono text-white/60">frontend/.env.botchain</span> and host the frontend (Vercel works out of the box via <span className="mono text-white/60">vercel.json</span>).</p>
          <p className="mt-2 text-white/40">The vault is now live at <span className="mono text-white/60">{config.parentName}</span> with a {config.seatCount}-seat, threshold-3 configuration.</p>
        </Step>

        <Step n="2" role="Each Member" title="Get an ENS name &amp; publish your meta-address">
          <p>Go to <strong className="text-white/80">Screen 3 — My Role</strong>.</p>
          <ol className="space-y-2 mt-3 pl-4 list-decimal list-inside marker:text-white/30">
            <li>If you don't have a <span className="mono text-white/60">.eth</span> name on this network, use the <em className="text-white/60 not-italic">Register an ENS Name</em> section to claim one (free except gas).</li>
            <li>Click <strong className="text-white/80">Derive my keys and scan</strong>. MetaMask will ask you to sign a message — this is deterministic and reveals nothing.</li>
            <li>Your <em className="text-white/60 not-italic">Meta-Address</em> appears. Type your <span className="mono text-white/60">.eth</span> name in the publish field and click <strong className="text-white/80">Publish</strong>. This writes one text record on-chain.</li>
            <li>Send your <span className="mono text-white/60">.eth</span> name to the admin (or the admin reads it automatically in Screen 2).</li>
          </ol>
          <p className="mt-3 text-white/40">Nothing else happens. You receive no tokens, no messages, no transactions. Your signing identity is derived from your wallet signature — it doesn't exist on-chain.</p>
        </Step>

        <Step n="3" role="Admin" title="Appoint members to seats">
          <p>Go to <strong className="text-white/80">Screen 2 — Appoint</strong> (only visible if your wallet owns <span className="mono text-white/60">{config.parentName}</span>).</p>
          <ol className="space-y-2 mt-3 pl-4 list-decimal list-inside marker:text-white/30">
            <li>Enter the member's ENS name (e.g. <span className="mono text-white/60">alice.eth</span>).</li>
            <li>Pick a seat and a mandate duration.</li>
            <li>Click <strong className="text-white/80">Appoint</strong> — confirm 3 MetaMask transactions.</li>
            <li>Repeat for each member.</li>
          </ol>
          <p className="mt-3 text-white/40">The randomness that links the member's name to their stealth address exists only in your browser tab during these 3 transactions, then is gone. Even you cannot reconstruct it afterwards.</p>
          <div className="mt-4 border-l-2 border-amber-500/30 bg-amber-500/5 px-4 py-3 text-amber-200/70">
            <strong className="text-amber-200/90">Important:</strong> Export your address book (bottom of Screen 2) immediately after appointing. You'll need it to rotate addresses later.
          </div>
        </Step>

        <Step n="4" role="Members" title="Detect your seat">
          <p>After the admin appoints you, go back to <strong className="text-white/80">Screen 3 — My Role</strong> and click <strong className="text-white/80">Derive my keys and scan</strong> again.</p>
          <p className="mt-2">Your seat will appear with its expiry date. No transaction happened — it was calculated from the on-chain announcement and your private view key.</p>
        </Step>

        <Step n="5" role="Members" title="Sign a transaction">
          <p>Go to <strong className="text-white/80">Screen 4 — Sign</strong>.</p>
          <ol className="space-y-2 mt-3 pl-4 list-decimal list-inside marker:text-white/30">
            <li>Any member (or even a non-member) can <strong className="text-white/80">Propose</strong> a transaction — enter recipient, amount, and optional calldata.</li>
            <li>Each signer clicks <strong className="text-white/80">Sign with my stealth key</strong>. The signature is stored locally.</li>
            <li>To collect signatures from multiple signers, use <strong className="text-white/80">Export / Import</strong> to pass the JSON between browsers — no backend needed.</li>
            <li>Once the threshold is reached, any connected wallet can click <strong className="text-white/80">Execute</strong> and pay gas. The executing wallet is not a signer and reveals nothing.</li>
          </ol>
        </Step>

        <Step n="6" role="Admin" title="Mandate lifecycle — expiry, rotation, revocation">
          <ul className="space-y-3 mt-2">
            <li><strong className="text-white/80">Expiry:</strong> When a mandate expires, the seat stops working automatically. No one needs to act.</li>
            <li><strong className="text-white/80">Rotation:</strong> On Screen 2, use the <span className="mono text-white/60">↻ seat-N</span> buttons to assign a new stealth address to an existing seat without changing the mandate. Do this if you suspect an address was observed. Don't rotate while signatures are pending.</li>
            <li><strong className="text-white/80">Revocation:</strong> Contact the deployer to call <span className="mono text-white/60">removeSeat(node)</span> on the contract — or simply let the mandate expire.</li>
          </ul>
        </Step>
      </section>

      {/* ── Key properties ────────────────────────────────────── */}
      <section className="space-y-4 border-t border-white/10 pt-12">
        <h3 className="text-xs uppercase tracking-[0.2em] text-white/50 mb-3">Key Properties</h3>
        <div className="grid gap-4">
          {[
            ['The body is public', 'Anyone can see who the members are. The vault name and member registry are public on-chain.'],
            ['Who acts is not', 'The connection between a member name and their signing address cannot be reconstructed from on-chain data.'],
            ['Mandates expire automatically', 'A seat stops working when its ENS subname expires. No action needed.'],
            ['Addresses rotate without breaking mandates', 'The seat is the ENS name. The key under it can change.'],
            ['No backend', 'Everything is client + chain. Signatures are JSON files you can email.'],
            ['Any wallet executes', 'The wallet that pays gas for execution has no connection to the signers.'],
          ].map(([title, desc]) => (
            <div key={title} className="flex gap-4">
              <span className="text-emerald-400/60 mt-0.5 shrink-0">✓</span>
              <div>
                <span className="text-white/80">{title}</span>
                <span className="text-white/40"> — {desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Limitations ───────────────────────────────────────── */}
      <section className="space-y-4 border-t border-white/10 pt-12">
        <h3 className="text-xs uppercase tracking-[0.2em] text-white/50 mb-3">Known Limitations</h3>
        <div className="grid gap-3">
          {[
            ['The appointer knows the mapping', 'The admin who appoints knows which stealth address belongs to which member. This is mathematically irreducible — they produce the randomness.'],
            ['Addresses are pseudonyms', 'A fixed stealth address across many transactions is a persistent pseudonym. Rotate periodically to reduce accumulation.'],
            ['localStorage is local', 'Pending signatures and the nomination address book live in the browser. Export before clearing browser data.'],
            ['One vault per deployment', 'There is no factory. Each organisation deploys its own instance by running the setup scripts.'],
          ].map(([title, desc]) => (
            <div key={title} className="flex gap-4">
              <span className="text-amber-400/60 mt-0.5 shrink-0">⚠</span>
              <div>
                <span className="text-white/80">{title}</span>
                <span className="text-white/40"> — {desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Contract info ─────────────────────────────────────── */}
      <section className="space-y-3 border-t border-white/10 pt-12">
        <h3 className="text-xs uppercase tracking-[0.2em] text-white/50 mb-3">Deployed Contracts</h3>
        <table className="w-full text-xs">
          <tbody className="divide-y divide-white/5">
            {[
              ['GoraVault', config.vault],
              ['ENS Registry', config.ensRegistry],
              ['Name Wrapper', config.nameWrapper],
              ['Public Resolver', config.publicResolver],
            ].map(([label, addr]) => (
              <tr key={label} className="py-2">
                <td className="py-2 text-white/40 pr-6 whitespace-nowrap">{label}</td>
                <td className="py-2 mono text-white/60">
                  {explorerBase ? (
                    <a href={`${explorerBase}/address/${addr}`} target="_blank" rel="noopener" className="hover:text-white transition-colors underline decoration-white/20">
                      {addr}
                    </a>
                  ) : addr}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-white/30 pt-2">
          Chain ID: {config.chainId} · Threshold: {config.seatCount} seats, 3-of-{config.seatCount} required
        </p>
      </section>
    </div>
  )
}

function Step({ n, role, title, children }: { n: string; role: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-6">
      <div className="shrink-0 w-8 h-8 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-white/60 text-xs font-mono">
        {n}
      </div>
      <div className="space-y-2 flex-1">
        <div className="flex items-center gap-3">
          <h4 className="text-white/90 font-light">{title}</h4>
          <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 text-white/40">{role}</span>
        </div>
        <div className="text-white/50 space-y-2">{children}</div>
      </div>
    </div>
  )
}
