import React from "react";
import { Navigate } from "react-router-dom";
import Feature from "../../components/Feature";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import { useWallet } from "../../context/WalletContext";

const Home = () => {
  const { isConnected } = useWallet();

  if (isConnected) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Header />
      <div className="area">
        <ul className="circles">
          <li></li><li></li><li></li><li></li><li></li>
          <li></li><li></li><li></li><li></li><li></li>
        </ul>
      </div>
      <div className="relative z-10 pt-24 w-full p-4">
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-5xl md:text-7xl font-bold text-center text-white drop-shadow-lg">
            Send BOT instantly
          </p>
          <p className="text-xl md:text-2xl text-white mt-4 text-center max-w-2xl drop-shadow">
            A clean, BOT Chain-native finance experience. Connect your wallet and start sending BOT in seconds.
          </p>
        </div>
        <Feature />
        <Footer />
      </div>
    </div>
  );
};

export default Home;
