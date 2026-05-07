"use client";

import { motion, AnimatePresence } from "framer-motion";
import { getExplorerTxUrl } from "@/lib/chains";

export type TxState =
  | { status: "idle" }
  | { status: "encrypting" }
  | { status: "pending"; description: string }
  | { status: "mining"; hash: string; chainId: number }
  | { status: "confirmed"; hash: string; chainId: number; label: string }
  | { status: "error"; message: string };

interface Props {
  state: TxState;
  onReset?: () => void;
}

const DOT_COLORS = {
  encrypting: "var(--accent-warning)",
  pending:    "var(--accent-warning)",
  mining:     "#3B82F6",
  confirmed:  "var(--accent-success)",
  error:      "var(--accent-error)",
};

const Dot = ({ color, pulse = false }: { color: string; pulse?: boolean }) => (
  <motion.div
    animate={pulse ? { opacity: [1, 0.35, 1] } : {}}
    transition={pulse ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : {}}
    style={{
      width: "6px",
      height: "6px",
      borderRadius: "50%",
      background: color,
      flexShrink: 0,
      marginTop: "2px",
    }}
  />
);

const ExternalLinkIcon = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
    <path d="M2 10L10 2M10 2H5M10 2v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function TxHashLink({ hash, chainId }: { hash: string; chainId: number }) {
  const url = getExplorerTxUrl(chainId, hash);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mono"
      style={{
        fontSize: "0.6875rem",
        color: "var(--text-muted)",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        textDecoration: "none",
        transition: `color var(--transition-fast)`,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
    >
      {hash.slice(0, 8)}…{hash.slice(-6)}
      <ExternalLinkIcon />
    </a>
  );
}

export function TransactionStatus({ state, onReset }: Props) {
  return (
    <AnimatePresence>
      {state.status !== "idle" && (
        <motion.div
          key="status"
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: "auto", marginTop: "0.5rem" }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.2 }}
          style={{ overflow: "hidden" }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.8125rem" }}>
            {/* Status dot — state can never be "idle" inside AnimatePresence */}
            <Dot
                color={DOT_COLORS[state.status] ?? "var(--text-muted)"}
                pulse={state.status === "pending" || state.status === "mining" || state.status === "encrypting"}
              />

            <div style={{ flex: 1, minWidth: 0 }}>
              {state.status === "encrypting" && (
                <span style={{ color: "var(--accent-warning)" }}>Encrypting with FHEVM…</span>
              )}
              {state.status === "pending" && (
                <span style={{ color: "var(--text-secondary)" }}>{state.description}</span>
              )}
              {state.status === "mining" && (
                <div>
                  <span style={{ color: "var(--text-secondary)", display: "block" }}>Waiting for confirmation…</span>
                  <TxHashLink hash={state.hash} chainId={state.chainId} />
                </div>
              )}
              {state.status === "confirmed" && (
                <div>
                  <span style={{ color: "var(--accent-success)", display: "block" }}>{state.label}</span>
                  <TxHashLink hash={state.hash} chainId={state.chainId} />
                  {onReset && (
                    <button
                      onClick={onReset}
                      style={{
                        display: "block",
                        marginTop: "2px",
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
                      Dismiss
                    </button>
                  )}
                </div>
              )}
              {state.status === "error" && (
                <div>
                  <span style={{ color: "var(--accent-error)", display: "block" }}>{state.message}</span>
                  {onReset && (
                    <button
                      onClick={onReset}
                      style={{
                        display: "block",
                        marginTop: "2px",
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
                      Try again
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
