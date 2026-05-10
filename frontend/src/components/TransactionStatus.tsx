"use client";

import { motion, AnimatePresence } from "framer-motion";
import { getExplorerTxUrl } from "@/lib/chains";

export type TxState =
  | { status: "idle" }
  | { status: "encrypting" }
  | { status: "pending"; description: string }
  | { status: "mining"; hash: string; chainId: number }
  | { status: "confirmed"; hash: string; chainId: number; label: string }
  | { status: "relay_attesting"; burnTxHash: string }
  | { status: "relay_relaying"; burnTxHash: string }
  | { status: "relay_complete"; relayTxHash: string; destChainId: number }
  | { status: "error"; message: string };

interface Props {
  state: TxState;
  onReset?: () => void;
}

const STATUS_CONFIG: Record<string, { color: string; pulse: boolean }> = {
  encrypting:      { color: "var(--accent-warning)", pulse: true },
  pending:         { color: "var(--accent-warning)", pulse: true },
  mining:          { color: "var(--accent-arb)",     pulse: true },
  confirmed:       { color: "var(--accent-success)", pulse: false },
  relay_attesting: { color: "var(--accent-warning)", pulse: true },
  relay_relaying:  { color: "var(--accent-arb)",     pulse: true },
  relay_complete:  { color: "var(--accent-success)", pulse: false },
  error:           { color: "var(--accent-error)",   pulse: false },
};

function Dot({ color, pulse }: { color: string; pulse: boolean }) {
  return (
    <motion.div
      animate={pulse ? { opacity: [1, 0.3, 1] } : {}}
      transition={pulse ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : {}}
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        marginTop: 2,
      }}
    />
  );
}

function ExternalIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2 10L10 2M10 2H5M10 2v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
        transition: "color var(--transition-fast)",
        marginTop: "0.125rem",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)")}
    >
      {hash.slice(0, 8)}…{hash.slice(-6)}
      <ExternalIcon />
    </a>
  );
}

function ActionBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-block",
        marginTop: "0.25rem",
        fontSize: "0.6875rem",
        color: "var(--text-muted)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        transition: "color var(--transition-fast)",
        letterSpacing: "-0.01em",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)")}
    >
      {label}
    </button>
  );
}

export function TransactionStatus({ state, onReset }: Props) {
  return (
    <AnimatePresence>
      {state.status !== "idle" && (
        <motion.div
          key="status"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.18 }}
          style={{ overflow: "hidden" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.5rem",
              fontSize: "0.8125rem",
              marginTop: "0.875rem",
              padding: "0.75rem 0.875rem",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <Dot
              color={STATUS_CONFIG[state.status]?.color ?? "var(--text-muted)"}
              pulse={STATUS_CONFIG[state.status]?.pulse ?? false}
            />

            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0.125rem" }}>
              {state.status === "encrypting" && (
                <span style={{ color: "var(--accent-warning)" }}>Encrypting with FHEVM…</span>
              )}
              {state.status === "pending" && (
                <span style={{ color: "var(--text-secondary)" }}>{state.description}</span>
              )}
              {state.status === "mining" && (
                <>
                  <span style={{ color: "var(--text-secondary)" }}>Waiting for confirmation…</span>
                  <TxHashLink hash={state.hash} chainId={state.chainId} />
                </>
              )}
              {state.status === "confirmed" && (
                <>
                  <span style={{ color: "var(--accent-success)" }}>{state.label}</span>
                  <TxHashLink hash={state.hash} chainId={state.chainId} />
                  {onReset && <ActionBtn onClick={onReset} label="Dismiss" />}
                </>
              )}
              {state.status === "relay_attesting" && (
                <span style={{ color: "var(--accent-warning)", lineHeight: 1.55 }}>
                  CCTP burn confirmed — awaiting Circle attestation (5–40 min)…
                </span>
              )}
              {state.status === "relay_relaying" && (
                <span style={{ color: "var(--text-secondary)" }}>
                  Attestation ready — submitting relay to destination chain…
                </span>
              )}
              {state.status === "relay_complete" && (
                <>
                  <span style={{ color: "var(--accent-success)" }}>
                    Bridge complete — USDC encrypted on destination chain
                  </span>
                  <TxHashLink hash={state.relayTxHash} chainId={state.destChainId} />
                  {onReset && <ActionBtn onClick={onReset} label="Dismiss" />}
                </>
              )}
              {state.status === "error" && (
                <>
                  <span style={{ color: "var(--accent-error)", lineHeight: 1.55 }}>{state.message}</span>
                  {onReset && <ActionBtn onClick={onReset} label="Try again" />}
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
