import React from "react";
import { Navigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

const PrivateRoute = ({ children }) => {
  const { isConnected } = useWallet();
  return isConnected ? children : <Navigate to="/" />;
};

export default PrivateRoute;
