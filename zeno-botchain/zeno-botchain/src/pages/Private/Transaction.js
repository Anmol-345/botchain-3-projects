import React, { useEffect, useState } from "react";
import { Table } from "react-bootstrap";
import { useWallet } from "../../context/WalletContext";
import { explorerLink, formatAddress } from "../../constants";
import Loader from "../../components/Loader";

const Transaction = () => {
  const { account, provider } = useWallet();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    const key = `zeno-history-${account}`;
    const local = JSON.parse(localStorage.getItem(key) || "[]");
    setHistory(local);
    setLoading(false);
  }, [account]);

  return (
    <div className="mt-4 md:mx-4 mx-0">
      <h1 className="text-center font-semibold md:text-4xl text-2xl mb-2">Transaction History</h1>
      <p className="text-center text-gray-600 text-sm mb-6">Recent BOT payments from this device</p>

      {loading ? (
        <div className="flex justify-center mt-20">
          <Loader />
        </div>
      ) : history.length > 0 ? (
        <div className="overflow-x-auto rounded-lg shadow">
          <Table striped bordered hover size="sm" className="bg-white mb-0">
            <thead className="bg-purple-700 text-white">
              <tr>
                <th className="text-center py-2">Date</th>
                <th className="text-center py-2">To</th>
                <th className="text-center py-2">Amount</th>
                <th className="text-center py-2">Memo</th>
                <th className="text-center py-2">Tx</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item, idx) => (
                <tr key={idx}>
                  <td className="text-center py-2 align-middle">
                    {new Date(item.timestamp).toLocaleString()}
                  </td>
                  <td className="text-center py-2 align-middle font-mono text-xs">
                    {formatAddress(item.to)}
                  </td>
                  <td className="text-center py-2 align-middle font-semibold">{item.amount} BOT</td>
                  <td className="text-center py-2 align-middle text-sm">{item.memo}</td>
                  <td className="text-center py-2 align-middle">
                    <a
                      href={explorerLink(item.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-700 underline text-sm"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ) : (
        <p className="text-center mt-20 text-gray-500 text-lg">No transactions yet</p>
      )}
    </div>
  );
};

export default Transaction;
