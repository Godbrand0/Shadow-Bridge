"use client";

import { motion } from "framer-motion";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <motion.header
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-subtle)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div
        className="max-w-5xl mx-auto px-6"
        style={{ height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "var(--text-primary)", fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "-0.02em" }}>
            ShadowBridge
          </span>
          <span style={{ color: "var(--border-default)", fontSize: "0.75rem" }}>·</span>
          <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", letterSpacing: "0.01em" }} className="hidden sm:block">
            Confidential Cross-Chain
          </span>
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          {/* FHE status dot */}
          <div className="hidden sm:flex" style={{ alignItems: "center", gap: "0.375rem" }}>
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent-success)" }}
            />
            <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", letterSpacing: "0.02em" }}>
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
