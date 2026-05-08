"use client";

import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { UnifiedBridgePanel } from "@/components/UnifiedBridgePanel";
import { ExplorerPreview } from "@/components/ExplorerPreview";

export default function Home() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg-base)",
        backgroundImage:
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.06) 0%, transparent 100%)",
      }}
    >
      <Header />

      <main className="max-w-5xl mx-auto px-6 pt-10 pb-16">
        {/* Hero title/subtitle */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              fontSize: "2.5rem",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: "var(--text-primary)",
              marginBottom: "0.75rem",
            }}
          >
            Confidential Cross-Chain
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            style={{
              color: "var(--text-muted)",
              fontSize: "1rem",
              letterSpacing: "0.01em",
              maxWidth: "400px",
              margin: "0 auto",
            }}
          >
            Bridge USDC between Ethereum, Base, and Arbitrum with FHE encryption.
            Amounts stay private until you reveal them.
          </motion.p>
        </div>

        {/* Unified Panel */}
        <div style={{ marginBottom: "4rem" }}>
          <UnifiedBridgePanel />
        </div>

        {/* Info Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16"
        >
          <InfoCard
            title="Encrypted Balances"
            desc="USDC amounts are wrapped into euint64 handles. Plaintext numbers never touch the L2 state."
            icon="🔒"
          />
          <InfoCard
            title="Circle CCTP V2"
            desc="Leveraging official mint/burn infrastructure for zero-slippage cross-chain liquidity."
            icon="🌐"
          />
          <InfoCard
            title="Zama FHEVM"
            desc="Powered by Fully Homomorphic Encryption, allowing computation on ciphertexts."
            icon="⚡"
          />
        </motion.div>

        <ExplorerPreview />

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          style={{ textAlign: "center", marginTop: "4rem" }}
        >
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
            <span>Built with</span>
            <span style={{ color: "var(--accent-base)", fontWeight: 500 }}>Base</span>
            <span style={{ color: "var(--border-default)" }}>·</span>
            <span style={{ color: "var(--accent-arb)", fontWeight: 500 }}>Arbitrum</span>
            <span style={{ color: "var(--border-default)" }}>·</span>
            <span style={{ color: "var(--accent-eth)", fontWeight: 500 }}>Ethereum</span>
          </p>
        </motion.footer>
      </main>
    </div>
  );
}

function InfoCard({ title, desc, icon }: { title: string; desc: string; icon: string }) {
  return (
    <div style={{ padding: "1.5rem", borderRadius: "var(--radius-lg)", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
      <div style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>{icon}</div>
      <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.5rem" }}>{title}</h3>
      <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}
