import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import Home from "./pages/Public/Home";
import PrivateRoute from "./routes/PrivateRoute";
import Dashboard from "./pages/Private/Dashboard";
import Payment from "./pages/Private/Payment";
import Transaction from "./pages/Private/Transaction";
import Account from "./pages/Private/Account";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        >
          <Route path="dashboard" element={<Payment />} />
          <Route path="transactions/history" element={<Transaction />} />
          <Route path="account" element={<Account />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
