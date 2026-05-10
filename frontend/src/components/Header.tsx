"use client";

import { motion } from "framer-motion";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ThemeToggle } from "./ThemeToggle";

/* Lock icon — signals encryption */
function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="3" y="7" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--bg-base)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div
        className="max-w-5xl mx-auto px-6"
        style={{
          height: "54px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "var(--radius-sm)",
              background: "var(--accent-primary-muted)",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent-primary)",
              flexShrink: 0,
            }}
          >
            <LockIcon />
          </div>
          <span
            style={{
              color: "var(--text-primary)",
              fontSize: "0.875rem",
              fontWeight: 600,
              letterSpacing: "-0.025em",
            }}
          >
            ShadowBridge
          </span>
          <span
            className="hidden sm:block"
            style={{
              color: "var(--border-strong)",
              fontSize: "0.6875rem",
              lineHeight: 1,
              paddingLeft: "0.25rem",
            }}
          >
            /
          </span>
          <span
            className="hidden sm:block"
            style={{
              color: "var(--text-muted)",
              fontSize: "0.75rem",
              letterSpacing: "-0.01em",
            }}
          >
            Confidential Cross-Chain
          </span>
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* FHE status indicator */}
          <div
            className="hidden sm:flex"
            style={{
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.3125rem 0.625rem",
              background: "var(--accent-success-muted)",
              border: "1px solid rgba(16, 185, 129, 0.18)",
              borderRadius: "var(--radius-2xl)",
            }}
          >
            <motion.div
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--accent-success)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 500,
                color: "var(--accent-success)",
                letterSpacing: "0.01em",
              }}
            >
              FHE active
            </span>
          </div>

          <ThemeToggle />

          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus="address"
          />
        </div>
      </div>
    </motion.header>
  );
}
