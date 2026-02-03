"use client";

import { useState } from "react";

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleSection({ title, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white border border-[#9aafe5]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#6d84b4] px-2 py-1 flex justify-between items-center cursor-pointer hover:bg-[#5a7099] transition-colors"
      >
        <h2 className="text-white text-xs font-bold">{title}</h2>
        <span className="text-white text-xs">{isOpen ? "▼" : "▶"}</span>
      </button>
      {isOpen && <div className="p-3">{children}</div>}
    </div>
  );
}

export default CollapsibleSection;
