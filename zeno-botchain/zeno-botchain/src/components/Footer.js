import React from "react";
import { BsBoxArrowUpRight } from "react-icons/bs";
import botchainLogo from "../botchain-logo.jpeg";
import { ZENO_PAYMENT_ADDRESS, BOT_CHAIN_EXPLORER, formatAddress } from "../constants";

const explorerBase = BOT_CHAIN_EXPLORER || "https://scan.botchain.ai";

const ecosystemLinks = [
  { label: "BOT Chain Official Website", href: "https://botchain.ai" },
  { label: "BOT Chain Explorer", href: "https://scan.botchain.ai" },
  ...(ZENO_PAYMENT_ADDRESS
    ? [
        {
          label: "Zeno Contract on BotScan",
          href: `${explorerBase}/address/${ZENO_PAYMENT_ADDRESS}`,
        },
      ]
    : []),
];

const Footer = () => {
  return (
    <footer className="w-full px-4 pb-8 mt-12 mx-auto sm:max-w-xl md:max-w-full lg:max-w-screen-xl">
      <div className="cl-div2 rounded-2xl p-6 md:p-8 shadow-lg text-white">
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            <div className="w-16 h-16 shrink-0 rounded-xl bg-white p-2 shadow">
              <img
                src={botchainLogo}
                alt="BOT Chain logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
                Ecosystem Partner
              </p>
              <p className="text-2xl font-bold">BOT Chain</p>
              <p className="mt-1 text-sm opacity-90 max-w-md">
                Zeno is built natively on BOT Chain Mainnet (chainId 677) —
                every payment is settled on-chain and publicly verifiable on
                BotScan.
              </p>
            </div>
          </div>
          <ul className="flex flex-col gap-2 w-full md:w-72">
            {ecosystemLinks.map(({ label, href }) => (
              <li key={href}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-white/25 hover:text-white transition"
                >
                  <span>{label}</span>
                  <BsBoxArrowUpRight size={14} className="opacity-80 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-6 pt-4 border-t border-white/20 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs opacity-90">
          <span>© {new Date().getFullYear()} Zeno — Send BOT instantly.</span>
          {ZENO_PAYMENT_ADDRESS && (
            <span>
              Contract:{" "}
              <a
                href={`${explorerBase}/address/${ZENO_PAYMENT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-mono text-white"
              >
                {formatAddress(ZENO_PAYMENT_ADDRESS)}
              </a>
            </span>
          )}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
