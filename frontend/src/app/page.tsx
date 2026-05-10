"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { UnifiedBridgePanel } from "@/components/UnifiedBridgePanel";
import { ExplorerPreview } from "@/components/ExplorerPreview";
import { TransactionHistory } from "@/components/TransactionHistory";

type Tab = "bridge" | "history";

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "3px",
        gap: "2px",
        marginBottom: "2.5rem",
      }}
    >
      {(["bridge", "history"] as Tab[]).map((tab) => {
        const isActive = active === tab;
        return (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            style={{
              padding: "0.4375rem 1.25rem",
              borderRadius: "calc(var(--radius-lg) - 2px)",
              border: "none",
              background: isActive ? "var(--bg-surface)" : "transparent",
              color: isActive ? "var(--text-primary)" : "var(--text-muted)",
              fontSize: "0.8125rem",
              fontWeight: isActive ? 600 : 400,
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              letterSpacing: "-0.01em",
              boxShadow: isActive ? "var(--shadow-sm)" : "none",
            }}
          >
            {tab === "history" ? "History" : "Bridge"}
          </button>
        );
      })}
    </div>
  );
}

function InfoCard({
  label,
  title,
  desc,
  accent,
  last,
}: {
  label: string;
  title: string;
  desc: string;
  accent: string;
  last: boolean;
}) {
  return (
    <div
      style={{
        padding: "1.75rem",
        background: "var(--bg-surface)",
        borderRight: last ? "none" : "1px solid var(--border-default)",
        position: "relative",
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "var(--radius-sm)",
          background: `${accent}18`,
          border: `1px solid ${accent}30`,
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: accent,
          }}
        />
      </div>
      <p
        className="label-caps"
        style={{ marginBottom: "0.5rem" }}
      >
        {label}
      </p>
      <h3
        style={{
          fontSize: "0.9375rem",
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: "0.5rem",
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", lineHeight: 1.7 }}>
        {desc}
      </p>
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("bridge");

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg-base)" }}>
      <Header />

      <main className="max-w-5xl mx-auto px-6 pt-14 pb-24">

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.3125rem 0.75rem",
              background: "var(--accent-primary-muted)",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              borderRadius: "var(--radius-2xl)",
              marginBottom: "1.5rem",
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--accent-primary)",
                animation: "pulse 2.4s ease-in-out infinite",
              }}
            />
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "var(--accent-primary)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Confidential Settlement Protocol
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.06 }}
            style={{
              fontSize: "clamp(2rem, 5vw, 2.75rem)",
              fontWeight: 700,
              letterSpacing: "-0.045em",
              color: "var(--text-primary)",
              marginBottom: "0.875rem",
              lineHeight: 1.1,
            }}
          >
            Confidential Cross-Chain
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12 }}
            style={{
              color: "var(--text-muted)",
              fontSize: "0.9375rem",
              maxWidth: "360px",
              margin: "0 auto",
              lineHeight: 1.7,
            }}
          >
            Bridge USDC across chains with FHE encryption.
            Amounts stay private until you reveal them.
          </motion.p>
        </div>

        {/* Tab panel */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "4.5rem" }}>
          <TabBar active={tab} onChange={setTab} />

          <div style={{ width: "100%", position: "relative" }}>
            <AnimatePresence mode="wait">
              {tab === "bridge" ? (
                <motion.div
                  key="bridge"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.16 }}
                >
                  <UnifiedBridgePanel />
                </motion.div>
              ) : (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.16 }}
                >
                  <TransactionHistory />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Info Grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.22 }}
          style={{ marginBottom: "4rem" }}
        >
          <div
            className="grid grid-cols-1 md:grid-cols-3"
            style={{
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-xl)",
              overflow: "hidden",
            }}
          >
            <InfoCard
              label="Privacy"
              title="Encrypted Balances"
              desc="USDC amounts are wrapped into euint64 handles. Plaintext numbers never touch L2 state."
              accent="var(--accent-primary)"
              last={false}
            />
            <InfoCard
              label="Liquidity"
              title="Circle CCTP V2"
              desc="Official mint-burn infrastructure for zero-slippage, canonical cross-chain USDC."
              accent="var(--accent-arb)"
              last={false}
            />
            <InfoCard
              label="Technology"
              title="Zama FHEVM"
              desc="Fully Homomorphic Encryption lets the chain compute on ciphertexts without decrypting."
              accent="var(--accent-success)"
              last={true}
            />
          </div>
        </motion.div>

        <ExplorerPreview />

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.4 }}
          style={{ textAlign: "center", marginTop: "4rem" }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: "0.375rem 1rem",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-2xl)",
            }}
          >
            {[
              { label: "ETH", color: "var(--accent-eth)" },
              { label: "BASE", color: "var(--accent-base)" },
              { label: "ARB", color: "var(--accent-arb)" },
            ].map((chain, i) => (
              <span key={chain.label} style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                {i > 0 && (
                  <span style={{ color: "var(--border-strong)", fontSize: "0.625rem" }}>·</span>
                )}
                <span style={{ display: "flex", alignItems: "center", gap: "0.3125rem" }}>
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: chain.color,
                      display: "inline-block",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: chain.color,
                      letterSpacing: "0.03em",
                    }}
                  >
                    {chain.label}
                  </span>
                </span>
              </span>
            ))}
            <span style={{ color: "var(--border-strong)", fontSize: "0.625rem" }}>·</span>
            <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>Sepolia testnet</span>
          </div>
        </motion.footer>
      </main>
    </div>
  );
}
