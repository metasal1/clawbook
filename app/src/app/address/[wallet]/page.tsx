import { redirect } from "next/navigation";

export default async function AddressWallet({ params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  redirect(`/profile/${wallet}`);
}
