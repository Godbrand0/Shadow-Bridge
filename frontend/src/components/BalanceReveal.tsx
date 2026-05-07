"use client";

import { useEffect, useState } from "react";
import { formatUsdc } from "@/lib/fhevm";

type Phase = "idle" | "decrypting" | "revealed";

interface Props {
  revealedAmount: bigint | null;
  isDecrypting: boolean;
  onReset?: () => void;
}

export function BalanceReveal({ revealedAmount, isDecrypting, onReset }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [displayAmount, setDisplayAmount] = useState<bigint | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (isDecrypting && revealedAmount === null) {
      setPhase("decrypting");
      setRevealed(false);
    } else if (revealedAmount !== null) {
      // Sit in decrypting-look for 1.5 s, then snap to revealed
      const t = setTimeout(() => {
        setDisplayAmount(revealedAmount);
        setPhase("revealed");
        // Trigger CSS class after a frame so transition fires
        requestAnimationFrame(() => setRevealed(true));
      }, 1500);
      return () => clearTimeout(t);
    } else {
      setPhase("idle");
      setRevealed(false);
    }
  }, [isDecrypting, revealedAmount]);

  const handleReset = () => {
    setPhase("idle");
    setDisplayAmount(null);
    setRevealed(false);
    onReset?.();
  };

  if (phase === "idle") return null;

  return (
    <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>

      {/* ── Decrypting phase ── */}
      {phase === "decrypting" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="text-sm leading-none select-none">🔒</span>
            <span
              className="font-[family-name:var(--font-mono)] text-3xl font-light tracking-widest select-none animate-pulse"
              style={{ color: "#1F2937", filter: "blur(4px)" }}
            >
              ••••••
            </span>
          </div>
          <p className="text-[#4B5563] text-xs pl-7">Decrypting from chain…</p>
        </div>
      )}

      {/* ── Revealed phase ── */}
      {phase === "revealed" && displayAmount !== null && (
        <div className="space-y-3">
          {/* Lock → unlock + number */}
          <div className="flex items-start gap-2.5">
            <span className="text-sm leading-none select-none mt-1">🔓</span>
            <div>
              <span
                className={`font-[family-name:var(--font-mono)] text-3xl font-light text-white tabular-nums ${revealed ? "balance-revealed" : ""}`}
                style={{ display: "block" }}
              >
                {formatUsdc(displayAmount)} USDC
              </span>
              {/* Thin green underline — the only celebration */}
              <div
                className="mt-1 h-[2px] rounded-full"
                style={{
                  background: "#22C55E",
                  width: revealed ? "100%" : "0%",
                  transition: "width 0.5s ease-out 0.2s",
                }}
              />
            </div>
          </div>

          {/* Verification note */}
          <p className="text-[#4B5563] text-xs pl-7 leading-relaxed">
            Verified on-chain · Encrypted until now
          </p>

          <button
            onClick={handleReset}
            className="text-[#374151] hover:text-[#6B7280] text-xs pl-7 transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
