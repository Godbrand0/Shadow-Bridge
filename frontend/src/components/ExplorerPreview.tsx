"use client";

import { motion } from "framer-motion";

const ENCRYPTED_BLOCK = "████████████";

type Row = {
  hash: string;
  chain: string;
  chainColor: string;
  event: string;
  hasAmount: boolean;
};

const ROWS: Row[] = [
  { hash: "0x3f2a…c901", chain: "ETH", chainColor: "var(--accent-eth)",  event: "depositConfidential()",      hasAmount: true  },
  { hash: "0x7e1b…44d2", chain: "Base", chainColor: "var(--accent-base)", event: "stake()",                    hasAmount: true  },
  { hash: "0x2d9f…b803", chain: "Base", chainColor: "var(--accent-base)", event: "decryptBalance()",            hasAmount: false },
  { hash: "0x8c3a…2f71", chain: "Base", chainColor: "var(--accent-base)", event: "onBalanceDecryptCallback()",  hasAmount: true  },
];

export function ExplorerPreview() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
        <p style={{ fontSize: "0.6875rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          What observers see on-chain
        </p>
        <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
      </div>

      {/* Table */}
      <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
        {/* Column headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 2.5fr 1fr",
            gap: "1rem",
            padding: "0.5rem 1rem",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-elevated)",
          }}
        >
          {["TX Hash", "Event", "Amount"].map((col) => (
            <span key={col} style={{ fontSize: "0.625rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
              {col}
            </span>
          ))}
        </div>

        {/* Rows */}
        {ROWS.map((row, i) => (
          <motion.div
            key={i}
            whileHover={{ background: "var(--bg-overlay)" }}
            transition={{ duration: 0.15 }}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2.5fr 1fr",
              gap: "1rem",
              padding: "0.625rem 1rem",
              alignItems: "center",
              background: i % 2 === 1 ? "var(--bg-elevated)" : "transparent",
              borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
              cursor: "default",
            }}
          >
            {/* Hash */}
            <span className="mono" style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
              {row.hash}
            </span>

            {/* Event */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: row.chainColor, flexShrink: 0 }} />
              <span className="mono" style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>{row.event}</span>
            </div>

            {/* Amount */}
            {row.hasAmount ? (
              <span
                className="mono"
                title="Encrypted — not visible to observers"
                style={{ fontSize: "0.75rem", color: "var(--bg-overlay)", letterSpacing: "-0.5px", userSelect: "none" }}
              >
                {ENCRYPTED_BLOCK}
              </span>
            ) : (
              <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>—</span>
            )}
          </motion.div>
        ))}
      </div>

      {/* Caption */}
      <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", textAlign: "center", marginTop: "0.75rem", fontStyle: "italic", lineHeight: 1.6 }}>
        All amounts and identities remain encrypted.
        Only event signatures are public.
      </p>
    </motion.section>
  );
}
