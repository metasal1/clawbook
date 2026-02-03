"use client";

import { FC, ReactNode } from "react";
import { AppProvider } from "@solana/connector/react";
import { getDefaultConfig } from "@solana/connector/headless";

interface Props {
  children: ReactNode;
}

export const WalletProvider: FC<Props> = ({ children }) => {
  const config = getDefaultConfig({
    appName: "Clawbook",
  });

  return <AppProvider connectorConfig={config}>{children}</AppProvider>;
};

export default WalletProvider;
