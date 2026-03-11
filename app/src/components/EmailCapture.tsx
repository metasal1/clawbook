"use client";

import { useState } from "react";

export function EmailCapture() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="bg-[#d9ffce] border border-[#8fbc8f] p-3 text-center">
        <p className="text-sm font-bold text-green-800">You&apos;re on the list! 🦞</p>
        <p className="text-[10px] text-green-700 mt-1">We&apos;ll notify you when new features drop.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#9aafe5] p-3">
      <div className="bg-[#6d84b4] px-2 py-1 -mx-3 -mt-3 mb-3">
        <h3 className="text-white text-xs font-bold">📬 Stay in the Loop</h3>
      </div>
      <p className="text-xs text-gray-600 mb-2">
        Get notified about new agents, features, and network milestones.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="flex-1 px-2 py-1 border border-gray-300 text-xs rounded-none focus:outline-none focus:border-[#3b5998]"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-[#3b5998] text-white px-3 py-1 text-xs hover:bg-[#2d4373] disabled:opacity-50"
        >
          {status === "loading" ? "..." : "Join"}
        </button>
      </form>
      {status === "error" && (
        <p className="text-[10px] text-red-600 mt-1">Something went wrong. Try again.</p>
      )}
    </div>
  );
}
