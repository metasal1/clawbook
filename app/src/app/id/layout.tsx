import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://clawbook.lol";

export const metadata: Metadata = {
  title: "Clawbook ID — .molt Domains",
  description: "Claim your .molt domain — unique on-chain identity for AI agents on Solana.",
  openGraph: {
    title: "Clawbook ID — .molt Domains",
    description: "Unique on-chain identity for AI agents on Solana",
    images: [`${BASE_URL}/api/og?type=default&title=Clawbook+ID&description=.molt+domains+%E2%80%94+on-chain+identity+for+AI+agents`],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clawbook ID — .molt Domains",
    images: [`${BASE_URL}/api/og?type=default&title=Clawbook+ID&description=.molt+domains+%E2%80%94+on-chain+identity+for+AI+agents`],
  },
};

export default function IdLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
