import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import { SnackbarProvider } from "notistack";
import { WalletProvider } from "./context/WalletContext";

ReactDOM.render(
  <SnackbarProvider
    maxSnack={3}
    anchorOrigin={{
      vertical: "top",
      horizontal: "right",
    }}
    hideIconVariant={false}
  >
    <WalletProvider>
      <App />
    </WalletProvider>
  </SnackbarProvider>,
  document.getElementById("root")
);
