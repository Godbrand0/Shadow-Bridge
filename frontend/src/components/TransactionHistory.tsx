"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { fetchHistory, type BridgeTx, type RelayStatus } from "@/lib/relay";

// ── Chain metadata ────────────────────────────────────────────────────────────

const CHAIN_META: Record<number, { name: string; short: string; color: string; explorer: string }> = {
  11155111: {
    name: "Ethereum Sepolia",
    short: "ETH",
    color: "var(--accent-eth)",
    explorer: "https://sepolia.etherscan.io",
  },
  84532: {
    name: "Base Sepolia",
    short: "BASE",
    color: "var(--accent-base)",
    explorer: "https://sepolia.basescan.org",
  },
  421614: {
    name: "Arbitrum Sepolia",
    short: "ARB",
    color: "var(--accent-arb)",
    explorer: "https://sepolia.arbiscan.io",
  },
};

const DOMAIN_TO_CHAIN_ID: Record<number, number> = {
  0: 11155111,
  6: 84532,
  3: 421614,
};

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<RelayStatus, string> = {
  pending:   "Pending",
  attesting: "Attesting",
  relaying:  "Relaying",
  completed: "Completed",
  failed:    "Failed",
};

const STATUS_COLOR: Record<RelayStatus, string> = {
  pending:   "var(--accent-warning)",
  attesting: "var(--accent-warning)",
  relaying:  "var(--accent-arb)",
  completed: "var(--accent-success)",
  failed:    "var(--accent-error)",
};

const STATUS_BG: Record<RelayStatus, string> = {
  pending:   "var(--accent-warning-muted)",
  attesting: "var(--accent-warning-muted)",
  relaying:  "rgba(40, 160, 240, 0.10)",
  completed: "var(--accent-success-muted)",
  failed:    "var(--accent-error-muted)",
};

const IN_PROGRESS: RelayStatus[] = ["pending", "attesting", "relaying"];

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RelayStatus }) {
  const isLive = IN_PROGRESS.includes(status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3125rem",
        fontSize: "0.625rem",
        fontWeight: 600,
        color: STATUS_COLOR[status],
        background: STATUS_BG[status],
        border: `1px solid ${STATUS_COLOR[status]}30`,
        borderRadius: "var(--radius-2xl)",
        padding: "0.1875rem 0.5625rem",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        flexShrink: 0,
      }}
    >
      {isLive && (
        <span
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: STATUS_COLOR[status],
            animation: "pulse 1.4s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}

// ── Chain chip ────────────────────────────────────────────────────────────────

function ChainChip({ chainId }: { chainId: number }) {
  const meta = CHAIN_META[chainId];
  if (!meta) return (
    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Chain {chainId}</span>
  );
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3125rem",
        fontSize: "0.75rem",
        fontWeight: 600,
        color: meta.color,
        letterSpacing: "0.01em",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "1px",
          background: meta.color,
          flexShrink: 0,
        }}
      />
      {meta.short}
    </span>
  );
}

// ── Tx hash link ──────────────────────────────────────────────────────────────

function TxLink({ hash, chainId, label }: { hash: string; chainId: number; label: string }) {
  const meta = CHAIN_META[chainId];
  const href = meta ? `${meta.explorer}/tx/${hash}` : "#";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mono"
      style={{
        fontSize: "0.6875rem",
        color: "var(--text-muted)",
        textDecoration: "none",
        transition: "color var(--transition-fast)",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)")}
    >
      <span style={{ color: "var(--text-muted)", marginRight: "0.1875rem" }}>{label}:</span>
      {hash.slice(0, 6)}…{hash.slice(-4)}
      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M2 10L10 2M10 2H5M10 2v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

// ── Relative time ─────────────────────────────────────────────────────────────

function RelativeTime({ ts }: { ts: number }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    function update() {
      const diff = Date.now() - ts;
      const s = Math.floor(diff / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      const d = Math.floor(h / 24);
      if (d > 0) setLabel(`${d}d ago`);
      else if (h > 0) setLabel(`${h}h ago`);
      else if (m > 0) setLabel(`${m}m ago`);
      else setLabel(`${s}s ago`);
    }
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [ts]);

  return (
    <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>{label}</span>
  );
}

// ── Refresh icon ──────────────────────────────────────────────────────────────

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      style={{ animation: spinning ? "spin 0.8s linear infinite" : "none" }}
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

// ── Tx row ────────────────────────────────────────────────────────────────────

function TxRow({ tx }: { tx: BridgeTx }) {
  const srcChainId = tx.sourceChainId;
  const destChainId = DOMAIN_TO_CHAIN_ID[tx.destDomain] ?? tx.destDomain;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        padding: "0.875rem 1.125rem",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <ChainChip chainId={srcChainId} />
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="2"
          style={{ flexShrink: 0, opacity: 0.5 }}
          aria-hidden
        >
          <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <ChainChip chainId={destChainId} />
        <div style={{ flex: 1 }} />
        <StatusBadge status={tx.status} />
        <RelativeTime ts={tx.createdAt} />
      </div>

      {/* Hash links */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.1875rem" }}>
        <TxLink hash={tx.burnTxHash} chainId={srcChainId} label="Burn" />
        {tx.relayTxHash && (
          <TxLink hash={tx.relayTxHash} chainId={destChainId} label="Relay" />
        )}
        {tx.status === "failed" && tx.error && (
          <span
            style={{
              fontSize: "0.6875rem",
              color: "var(--accent-error)",
              lineHeight: 1.5,
              marginTop: "0.125rem",
            }}
          >
            {tx.error.slice(0, 80)}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ connected }: { connected: boolean }) {
  return (
    <div
      style={{
        padding: "3rem 2rem",
        textAlign: "center",
        color: "var(--text-muted)",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "var(--radius-lg)",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1.25rem",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ opacity: 0.45 }}
          aria-hidden
        >
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p
        style={{
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "var(--text-secondary)",
          marginBottom: "0.375rem",
          letterSpacing: "-0.01em",
        }}
      >
        {connected ? "No transactions yet" : "Connect wallet to see history"}
      </p>
      <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
        {connected
          ? "Your bridge activity will appear here."
          : "Connect your wallet to view past bridge transactions."}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TransactionHistory() {
  const { address } = useAccount();
  const [txs, setTxs] = useState<BridgeTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(0);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const data = await fetchHistory(address);
      setTxs(data);
      setLastFetch(Date.now());
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-2xl)",
        maxWidth: "460px",
        margin: "0 auto",
        overflow: "hidden",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid var(--border-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <div>
          <p className="label-caps" style={{ marginBottom: "0.2rem" }}>Transaction History</p>
          <p
            style={{
              fontSize: "0.8125rem",
              color: "var(--text-secondary)",
              letterSpacing: "-0.01em",
            }}
          >
            {txs.length > 0
              ? `${txs.length} transaction${txs.length === 1 ? "" : "s"}`
              : "All bridges"}
          </p>
        </div>

        <button
          onClick={() => void load()}
          disabled={loading}
          title="Refresh"
          aria-label="Refresh transaction history"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            padding: "0.4375rem",
            cursor: loading ? "not-allowed" : "pointer",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all var(--transition-fast)",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-default)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
          }}
        >
          <RefreshIcon spinning={loading} />
        </button>
      </div>

      {/* Content */}
      <div style={{ maxHeight: "420px", overflowY: "auto" }}>
        {!address ? (
          <EmptyState connected={false} />
        ) : loading && txs.length === 0 ? (
          <div
            style={{
              padding: "3rem 2rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <RefreshIcon spinning />
          </div>
        ) : txs.length === 0 ? (
          <EmptyState connected />
        ) : (
          <AnimatePresence initial={false}>
            {txs.map((tx) => (
              <TxRow key={tx.burnTxHash} tx={tx} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      {txs.length > 0 && lastFetch > 0 && (
        <div
          style={{
            padding: "0.5625rem 1.25rem",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <span style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>
            Updated <RelativeTime ts={lastFetch} />
          </span>
        </div>
      )}
    </motion.div>
  );
}
