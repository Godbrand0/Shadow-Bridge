"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Header() {
  return (
    <header
      className="sticky top-0 z-40 w-full"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(12,12,16,0.92)", backdropFilter: "blur(12px)" }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

        {/* Wordmark */}
        <div className="flex flex-col justify-center">
          <span className="text-white text-sm font-medium leading-tight tracking-tight">
            ShadowBridge
          </span>
          <span className="text-[#4B5563] text-[11px] leading-tight mt-px hidden sm:block">
            Confidential Cross-Chain Settlement
          </span>
        </div>

        {/* Right: status badge + wallet */}
        <div className="flex items-center gap-3">
          {/* FHE status — just a dot and text, nothing flashy */}
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" style={{ boxShadow: "0 0 4px rgba(34,197,94,0.5)" }} />
            <span className="text-[#4B5563] text-xs">FHE active</span>
          </div>

          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus="address"
          />
        </div>

      </div>
    </header>
  );
}
