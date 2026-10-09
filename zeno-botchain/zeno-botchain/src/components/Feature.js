import React from "react";
import { GiReceiveMoney } from "react-icons/gi";
import { BsShieldCheck, BsLightningCharge } from "react-icons/bs";
const Feature = () => {
  return (
    <div className="px-4 py-12 mx-auto sm:max-w-xl md:max-w-full lg:max-w-screen-xl md:px-24 lg:px-8">
      <div className="grid gap-8 row-gap-8 lg:grid-cols-3">
        <div className="sm:text-center cl-div2 rounded-2xl p-6 shadow-lg text-white">
          <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-white/20 sm:mx-auto sm:w-20 sm:h-20">
            <BsLightningCharge size={36} />
          </div>
          <h6 className="mb-2 font-semibold text-lg leading-5">Fast transfers</h6>
          <p className="max-w-md mb-3 sm:mx-auto text-sm opacity-90">
            Send native BOT to any address with near-instant finality.
          </p>
        </div>
        <div className="sm:text-center cl-div2 rounded-2xl p-6 shadow-lg text-white">
          <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-white/20 sm:mx-auto sm:w-20 sm:h-20">
            <GiReceiveMoney size={36} />
          </div>
          <h6 className="mb-2 font-semibold text-lg leading-5">Track payments</h6>
          <p className="max-w-md mb-3 sm:mx-auto text-sm opacity-90">
            Every payment is recorded on-chain with a transaction hash.
          </p>
        </div>
        <div className="sm:text-center cl-div2 rounded-2xl p-6 shadow-lg text-white">
          <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-white/20 sm:mx-auto sm:w-20 sm:h-20">
            <BsShieldCheck size={36} />
          </div>
          <h6 className="mb-2 font-semibold text-lg leading-5">Secure & simple</h6>
          <p className="max-w-md mb-3 sm:mx-auto text-sm opacity-90">
            No fiat intermediaries — just your wallet and the BOT Chain.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Feature;
