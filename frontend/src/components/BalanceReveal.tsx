"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatUsdc } from "@/lib/fhevm";

type Phase = "idle" | "decrypting" | "revealed";

interface Props {
  revealedAmount: bigint | null;
  isDecrypting: boolean;
  onReset?: () => void;
}

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "2px" }}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const UnlockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "2px" }}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export function BalanceReveal({ revealedAmount, isDecrypting, onReset }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [displayAmount, setDisplayAmount] = useState<bigint | null>(null);
  const [greenLineWidth, setGreenLineWidth] = useState("0%");

  useEffect(() => {
    if (isDecrypting && revealedAmount === null) {
      setPhase("decrypting");
    } else if (revealedAmount !== null) {
      const t = setTimeout(() => {
        setDisplayAmount(revealedAmount);
        setPhase("revealed");
        // Trigger green line after a frame
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setGreenLineWidth("100%"))
        );
      }, 1500);
      return () => clearTimeout(t);
    } else {
      setPhase("idle");
      setGreenLineWidth("0%");
    }
  }, [isDecrypting, revealedAmount]);

  const handleReset = () => {
    setPhase("idle");
    setDisplayAmount(null);
    setGreenLineWidth("0%");
    onReset?.();
  };

  return (
    <AnimatePresence>
      {phase !== "idle" && (
        <motion.div
          key="reveal-container"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            marginTop: "1.25rem",
            paddingTop: "1.25rem",
            borderTop: "1px solid var(--border-subtle)",
            overflow: "hidden",
          }}
        >
          {/* ── Decrypting phase ── */}
          <AnimatePresence mode="wait">
            {phase === "decrypting" && (
              <motion.div
                key="decrypting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  <motion.div
                    style={{ color: "var(--text-muted)" }}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <LockIcon />
                  </motion.div>
                  <motion.span
                    className="mono"
                    animate={{ opacity: [0.2, 0.5, 0.2] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      fontSize: "1.75rem",
                      fontWeight: 300,
                      color: "var(--text-muted)",
                      letterSpacing: "0.15em",
                      filter: "blur(3px)",
                    }}
                  >
                    ••••••
                  </motion.span>
                </div>
                <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.375rem", paddingLeft: "1.5rem" }}>
                  Decrypting from chain…
                </p>
              </motion.div>
            )}

            {/* ── Revealed phase ── */}
            {phase === "revealed" && displayAmount !== null && (
              <motion.div
                key="revealed"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
                  <motion.div
                    style={{ color: "var(--accent-success)" }}
                    initial={{ rotate: -10, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    <UnlockIcon />
                  </motion.div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* The number */}
                    <span
                      className="mono animate-focus-clear"
                      style={{
                        display: "block",
                        fontSize: "1.875rem",
                        fontWeight: 300,
                        color: "var(--text-primary)",
                        lineHeight: 1.1,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {formatUsdc(displayAmount)} USDC
                    </span>

                    {/* Thin green underline */}
                    <div
                      style={{
                        height: "2px",
                        borderRadius: "1px",
                        background: "var(--accent-success)",
                        marginTop: "4px",
                        width: greenLineWidth,
                        transition: "width 0.5s cubic-bezier(0.4,0,0.2,1) 0.15s",
                      }}
                    />

                    {/* Verification note */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        marginTop: "0.5rem",
                      }}
                    >
                      <span style={{ color: "var(--accent-success)" }}>
                        <CheckIcon />
                      </span>
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                        Verified on-chain
                      </span>
                      <span style={{ fontSize: "0.6875rem", color: "var(--border-default)" }}>·</span>
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                        Encrypted until this moment
                      </span>
                    </div>

                    <button
                      onClick={handleReset}
                      style={{
                        display: "block",
                        marginTop: "0.625rem",
                        fontSize: "0.6875rem",
                        color: "var(--text-muted)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        transition: `color var(--transition-fast)`,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
