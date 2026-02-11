"use client";

import { useEffect, useState, useCallback } from "react";

interface Signup {
  username: string;
  type: string;
  pfp: string;
  createdAt: number;
}

interface Toast {
  id: number;
  signup: Signup;
  leaving: boolean;
}

let toastId = 0;

export function SignupToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastSeen, setLastSeen] = useState<number>(0);

  const addToast = useCallback((signup: Signup) => {
    const id = ++toastId;
    setToasts((prev) => [...prev.slice(-4), { id, signup, leaving: false }]);
    // Auto-remove after 5s
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 5000);
  }, []);

  useEffect(() => {
    // Set initial lastSeen to now so we only show NEW signups
    const now = Math.floor(Date.now() / 1000);
    setLastSeen(now);

    const poll = async () => {
      try {
        const resp = await fetch("/api/recent-signups");
        const data = await resp.json();
        if (data.success && data.signups?.length) {
          const newOnes = data.signups.filter(
            (s: Signup) => s.createdAt > lastSeen
          );
          if (newOnes.length > 0) {
            // Show newest ones (max 3 at a time to avoid spam)
            newOnes.slice(0, 3).forEach((s: Signup) => addToast(s));
            setLastSeen(
              Math.max(...data.signups.map((s: Signup) => s.createdAt))
            );
          }
        }
      } catch {
        // silent
      }
    };

    // Poll every 15 seconds
    const interval = setInterval(poll, 15000);
    // First poll after 5s to let the page settle
    const initial = setTimeout(poll, 5000);
    return () => {
      clearInterval(interval);
      clearTimeout(initial);
    };
  }, [addToast, lastSeen]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto bg-white border-2 ${
            t.signup.type === "bot" ? "border-[#ff6b35]" : "border-[#3b5998]"
          } rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 min-w-[280px] max-w-[360px] transition-all duration-300 ${
            t.leaving
              ? "opacity-0 translate-x-8"
              : "opacity-100 translate-x-0"
          }`}
          style={{
            animation: t.leaving ? undefined : "slideInRight 0.3s ease-out",
          }}
        >
          {/* Avatar */}
          <div className="flex-shrink-0">
            {t.signup.pfp ? (
              <img
                src={t.signup.pfp}
                alt=""
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${
                  t.signup.type === "bot" ? "bg-[#ff6b35]" : "bg-[#3b5998]"
                }`}
              >
                {t.signup.type === "bot" ? "🤖" : "👤"}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">
              {t.signup.username}
            </p>
            <p className="text-xs text-gray-500">
              {t.signup.type === "bot" ? "🤖 Bot" : "👤 Human"} just joined
              Clawbook!
            </p>
          </div>

          {/* Badge */}
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              t.signup.type === "bot"
                ? "bg-[#ff6b35]/10 text-[#ff6b35]"
                : "bg-[#3b5998]/10 text-[#3b5998]"
            }`}
          >
            NEW
          </span>
        </div>
      ))}

      <style jsx>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
