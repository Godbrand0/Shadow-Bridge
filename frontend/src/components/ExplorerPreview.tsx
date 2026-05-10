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
  { hash: "0x3f2a…c901", chain: "ETH",  chainColor: "var(--accent-eth)",  event: "depositConfidential()",     hasAmount: true  },
  { hash: "0x7e1b…44d2", chain: "BASE", chainColor: "var(--accent-base)", event: "stake()",                   hasAmount: true  },
  { hash: "0x2d9f…b803", chain: "BASE", chainColor: "var(--accent-base)", event: "decryptBalance()",           hasAmount: false },
  { hash: "0x8c3a…2f71", chain: "BASE", chainColor: "var(--accent-base)", event: "onBalanceDecryptCallback()", hasAmount: true  },
];

export function ExplorerPreview() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.2 }}
      style={{ position: "relative" }}
    >
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: 8, height: 8, background: "var(--accent-primary)", boxShadow: "0 0 10px var(--accent-primary)" }} />
          <span className="label-caps" style={{ color: "var(--text-primary)" }}>
            Public Ledger Visualization
          </span>
        </div>
        <span className="mono" style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>
          MONITOR_ACTIVE_0X0
        </span>
      </div>

      {/* Table Container */}
      <div
        style={{
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          background: "var(--bg-surface)",
          position: "relative",
        }}
      >
        {/* Scanning Line Animation */}
        <motion.div
          animate={{ y: ["0%", "1000%"] }}
          transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "1px",
            background: "var(--accent-primary)",
            zIndex: 10,
            opacity: 0.2,
          }}
        />

        {/* Column headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 2fr 1fr",
            gap: "1rem",
            padding: "0.75rem 1.5rem",
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border-default)",
          }}
        >
          {["Signature", "Protocol Event", "Shadowed Data"].map((col) => (
            <span
              key={col}
              className="label-caps"
              style={{ fontSize: "0.5625rem", color: "var(--text-secondary)" }}
            >
              {col}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div style={{ position: "relative" }}>
          {ROWS.map((row, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -5 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 2fr 1fr",
                gap: "1rem",
                padding: "1rem 1.5rem",
                alignItems: "center",
                borderBottom: i === ROWS.length - 1 ? "none" : "1px solid var(--border-subtle)",
              }}
            >
              {/* Hash */}
              <span
                className="mono"
                style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}
              >
                {row.hash}
              </span>

              {/* Event */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div
                  style={{
                    width: 4,
                    height: 4,
                    background: row.chainColor,
                  }}
                />
                <span
                  className="mono"
                  style={{ fontSize: "0.75rem", color: "var(--text-primary)", fontWeight: 600 }}
                >
                  {row.event}
                </span>
              </div>

              {/* Amount */}
              {row.hasAmount ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="3">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span
                    className="mono"
                    title="Encrypted — not visible to observers"
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      letterSpacing: "0.1em",
                      opacity: 0.5,
                      userSelect: "none",
                    }}
                  >
                    {ENCRYPTED_BLOCK}
                  </span>
                </div>
              ) : (
                <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)", opacity: 0.3 }}>NULL</span>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Caption Area */}
      <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", padding: "0.5rem 1rem", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: 6, height: 6, background: "var(--accent-primary)" }} />
            <span style={{ fontSize: "0.625rem", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase" }}>FHE Enabled</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: 6, height: 6, background: "var(--text-muted)" }} />
            <span style={{ fontSize: "0.625rem", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase" }}>Public Data Locked</span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
