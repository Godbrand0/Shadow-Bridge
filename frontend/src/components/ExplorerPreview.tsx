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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.28 }}
    >
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.875rem",
          marginBottom: "1rem",
        }}
      >
        <span className="label-caps" style={{ whiteSpace: "nowrap" }}>
          What observers see on-chain
        </span>
        <div
          style={{
            flex: 1,
            height: "1px",
            background: "var(--border-subtle)",
          }}
        />
      </div>

      {/* Table */}
      <div
        style={{
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-xl)",
          overflow: "hidden",
        }}
      >
        {/* Column headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 2.8fr 1fr",
            gap: "1rem",
            padding: "0.5625rem 1.125rem",
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border-default)",
          }}
        >
          {["TX Hash", "Event", "Amount"].map((col) => (
            <span
              key={col}
              className="label-caps"
              style={{ letterSpacing: "0.07em" }}
            >
              {col}
            </span>
          ))}
        </div>

        {/* Rows */}
        {ROWS.map((row, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 2.8fr 1fr",
              gap: "1rem",
              padding: "0.6875rem 1.125rem",
              alignItems: "center",
              background: "var(--bg-surface)",
              borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
              transition: "background var(--transition-fast)",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-elevated)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-surface)")
            }
          >
            {/* Hash */}
            <span
              className="mono"
              style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}
            >
              {row.hash}
            </span>

            {/* Event */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "1px",
                  background: row.chainColor,
                  flexShrink: 0,
                }}
              />
              <span
                className="mono"
                style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}
              >
                {row.event}
              </span>
            </div>

            {/* Amount */}
            {row.hasAmount ? (
              <span
                className="mono"
                title="Encrypted — not visible to observers"
                style={{
                  fontSize: "0.6875rem",
                  color: "var(--border-strong)",
                  letterSpacing: "-1px",
                  userSelect: "none",
                }}
              >
                {ENCRYPTED_BLOCK}
              </span>
            ) : (
              <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>—</span>
            )}
          </div>
        ))}
      </div>

      {/* Caption */}
      <p
        style={{
          fontSize: "0.6875rem",
          color: "var(--text-muted)",
          textAlign: "center",
          marginTop: "0.75rem",
          lineHeight: 1.65,
        }}
      >
        All amounts remain encrypted on-chain. Only event signatures are public.
      </p>
    </motion.section>
  );
}
