"use client";

import { FC, ReactNode, useMemo } from "react";
import { AppProvider } from "@solana/connector/react";
import { getDefaultConfig } from "@solana/connector/headless";

interface Props {
  children: ReactNode;
}

export const WalletProvider: FC<Props> = ({ children }) => {
  const config = useMemo(() => {
    return getDefaultConfig({
      appName: "Clawbook",
      appUrl: typeof window !== "undefined" ? window.location.origin : "https://clawbook.vercel.app",
      autoConnect: true,
      enableMobile: true,
      // Don't restrict wallets - show all available
    });
  }, []);

  return <AppProvider connectorConfig={config}>{children}</AppProvider>;
};

export default WalletProvider;
