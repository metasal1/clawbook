"use client";

import { useConnector } from "@solana/connector/react";
import { useState } from "react";

export function WalletButton() {
  const { connectors, connectWallet, disconnectWallet, isConnected, isConnecting, account } = useConnector();
  const [showDropdown, setShowDropdown] = useState(false);

  const buttonStyle: React.CSSProperties = {
    fontFamily: "'Lucida Grande', Tahoma, Verdana, Arial, sans-serif",
    background: "linear-gradient(to bottom, #6d84b4, #5972a8)",
    border: "1px solid #29447e",
    borderRadius: "3px",
    color: "white",
    fontSize: "11px",
    fontWeight: "bold",
    padding: "4px 10px",
    cursor: "pointer",
    textShadow: "0 -1px 0 rgba(0, 0, 0, 0.2)",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.1)",
  };

  if (isConnected && account) {
    return (
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          style={buttonStyle}
        >
          {account.slice(0, 4)}...{account.slice(-4)} ▼
        </button>
        {showDropdown && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: "4px",
              background: "white",
              border: "1px solid #9aafe5",
              borderRadius: "3px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              minWidth: "120px",
              zIndex: 1000,
            }}
          >
            <button
              onClick={() => {
                disconnectWallet();
                setShowDropdown(false);
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "8px 12px",
                border: "none",
                background: "none",
                textAlign: "left",
                cursor: "pointer",
                fontSize: "11px",
                color: "#3b5998",
                fontFamily: "'Lucida Grande', Tahoma, Verdana, Arial, sans-serif",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#d8dfea")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  if (isConnecting) {
    return (
      <button style={{ ...buttonStyle, opacity: 0.7, cursor: "wait" }} disabled>
        Connecting...
      </button>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={buttonStyle}
      >
        Select Wallet ▼
      </button>
      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "4px",
            background: "white",
            border: "1px solid #9aafe5",
            borderRadius: "3px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            minWidth: "200px",
            maxHeight: "300px",
            overflowY: "auto",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid #d8dfea",
              fontSize: "11px",
              fontWeight: "bold",
              color: "#3b5998",
              fontFamily: "'Lucida Grande', Tahoma, Verdana, Arial, sans-serif",
            }}
          >
            Connect a Wallet
          </div>
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => {
                connectWallet(connector.id);
                setShowDropdown(false);
              }}
              disabled={!connector.ready}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                padding: "10px 12px",
                border: "none",
                borderBottom: "1px solid #f0f0f0",
                background: "none",
                textAlign: "left",
                cursor: connector.ready ? "pointer" : "not-allowed",
                fontSize: "11px",
                color: connector.ready ? "#333" : "#999",
                fontFamily: "'Lucida Grande', Tahoma, Verdana, Arial, sans-serif",
                opacity: connector.ready ? 1 : 0.5,
              }}
              onMouseEnter={(e) => {
                if (connector.ready) e.currentTarget.style.background = "#d8dfea";
              }}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              {connector.icon && (
                <img
                  src={connector.icon}
                  alt={connector.name}
                  style={{ width: "20px", height: "20px", borderRadius: "4px" }}
                />
              )}
              <span style={{ flex: 1 }}>{connector.name}</span>
              {connector.ready && (
                <span style={{ fontSize: "9px", color: "#666" }}>Detected</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default WalletButton;
