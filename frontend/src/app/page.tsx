"use client";

import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { EthSepoliaPanel } from "@/components/EthSepoliaPanel";
import { BaseSepoliaPanel } from "@/components/BaseSepoliaPanel";
import { ExplorerPreview } from "@/components/ExplorerPreview";

export default function Home() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg-base)",
        backgroundImage:
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.04) 0%, transparent 100%)",
      }}
    >
      <Header />

      <main className="max-w-5xl mx-auto px-6 pt-10 pb-16">
        {/* Hero subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          style={{
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "0.8125rem",
            marginBottom: "2.5rem",
            letterSpacing: "0.01em",
          }}
        >
          Amounts are encrypted before they touch the chain.
          Nobody reads them until you decide.
        </motion.p>

        {/* Two panels — staggered entrance via the panels themselves */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EthSepoliaPanel entranceDelay={0} />
          <BaseSepoliaPanel entranceDelay={0.1} />
        </div>

        {/* Bridge direction */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            margin: "1.5rem 0",
            userSelect: "none",
          }}
        >
          <span className="mono" style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
            Ethereum Sepolia
          </span>
          <span style={{ color: "var(--border-default)", fontSize: "0.6875rem" }}>
            ──── CCTP ────▶
          </span>
          <span className="mono" style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
            Base Sepolia
          </span>
        </motion.div>

        <ExplorerPreview />

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          style={{ textAlign: "center", marginTop: "3rem" }}
        >
          <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
            Powered by{" "}
            <span style={{ color: "var(--text-accent-base)" }}>Zama FHEVM</span>
            {" · "}
            <span style={{ color: "var(--text-accent-eth)" }}>Circle CCTP</span>
            {" · "}
            <span style={{ color: "var(--text-secondary)" }}>Base</span>
          </p>
        </motion.footer>
      </main>
    </div>
  );
}
