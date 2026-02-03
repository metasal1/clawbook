"use client";

import { useConnector } from "@solana/connector/react";
import { useState, useEffect, useRef } from "react";

export function WalletButton() {
  const { connectors, connectWallet, disconnectWallet, isConnected, isConnecting, account } = useConnector();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const dropdownStyle: React.CSSProperties = {
    position: "absolute",
    top: "100%",
    right: 0,
    marginTop: "4px",
    background: "white",
    border: "1px solid #9aafe5",
    borderRadius: "3px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    minWidth: "220px",
    maxHeight: "350px",
    overflowY: "auto",
    zIndex: 1000,
  };

  const itemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    width: "100%",
    padding: "10px 12px",
    border: "none",
    borderBottom: "1px solid #f0f0f0",
    background: "none",
    textAlign: "left",
    cursor: "pointer",
    fontSize: "11px",
    color: "#333",
    fontFamily: "'Lucida Grande', Tahoma, Verdana, Arial, sans-serif",
  };

  if (isConnected && account) {
    return (
      <div style={{ position: "relative" }} ref={dropdownRef}>
        <button onClick={() => setShowDropdown(!showDropdown)} style={buttonStyle}>
          {account.slice(0, 4)}...{account.slice(-4)} ▼
        </button>
        {showDropdown && (
          <div style={dropdownStyle}>
            <button
              onClick={() => {
                disconnectWallet();
                setShowDropdown(false);
              }}
              style={{ ...itemStyle, color: "#c00" }}
            >
              🔌 Disconnect Wallet
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

  // Filter to ready connectors
  const readyConnectors = connectors.filter((c) => c.ready);

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <button onClick={() => setShowDropdown(!showDropdown)} style={buttonStyle}>
        Select Wallet ▼
      </button>
      {showDropdown && (
        <div style={dropdownStyle}>
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
          
          {readyConnectors.length === 0 ? (
            <div style={{ padding: "12px", fontSize: "11px", color: "#666", textAlign: "center" }}>
              No wallets detected.<br />
              <a 
                href="https://phantom.app" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: "#3b5998", textDecoration: "underline" }}
              >
                Install Phantom →
              </a>
            </div>
          ) : (
            readyConnectors.map((connector) => (
              <button
                key={connector.id}
                onClick={() => {
                  connectWallet(connector.id);
                  setShowDropdown(false);
                }}
                style={itemStyle}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#d8dfea")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                {connector.icon && (
                  <img
                    src={connector.icon}
                    alt={connector.name}
                    style={{ width: "24px", height: "24px", borderRadius: "4px" }}
                  />
                )}
                <span style={{ flex: 1 }}>{connector.name}</span>
                <span style={{ fontSize: "9px", color: "#090", fontWeight: "bold" }}>✓</span>
              </button>
            ))
          )}
          
          {/* Also show not-ready connectors as installable */}
          {connectors.filter((c) => !c.ready).length > 0 && (
            <>
              <div
                style={{
                  padding: "6px 12px",
                  borderBottom: "1px solid #d8dfea",
                  borderTop: "1px solid #d8dfea",
                  fontSize: "10px",
                  color: "#999",
                  fontFamily: "'Lucida Grande', Tahoma, Verdana, Arial, sans-serif",
                  background: "#f9f9f9",
                }}
              >
                More Wallets
              </div>
              {connectors
                .filter((c) => !c.ready)
                .slice(0, 5)
                .map((connector) => (
                  <div
                    key={connector.id}
                    style={{ ...itemStyle, opacity: 0.5, cursor: "default" }}
                  >
                    {connector.icon && (
                      <img
                        src={connector.icon}
                        alt={connector.name}
                        style={{ width: "24px", height: "24px", borderRadius: "4px", opacity: 0.5 }}
                      />
                    )}
                    <span style={{ flex: 1, color: "#999" }}>{connector.name}</span>
                    <span style={{ fontSize: "9px", color: "#999" }}>Not installed</span>
                  </div>
                ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default WalletButton;
