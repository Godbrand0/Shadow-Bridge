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
  completed: "Settled",
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
  relaying:  "rgba(40, 160, 240, 0.08)",
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
        gap: "0.375rem",
        fontSize: "0.5625rem",
        fontWeight: 800,
        color: STATUS_COLOR[status],
        background: STATUS_BG[status],
        border: `1px solid ${STATUS_COLOR[status]}25`,
        borderRadius: "var(--radius-xs)",
        padding: "0.25rem 0.5rem",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        flexShrink: 0,
      }}
    >
      {isLive && (
        <span
          style={{
            width: 3,
            height: 3,
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
    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>CH {chainId}</span>
  );
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        fontSize: "0.75rem",
        fontWeight: 700,
        color: "var(--text-primary)",
      }}
    >
      <div
        style={{
          width: 5,
          height: 5,
          background: meta.color,
          flexShrink: 0,
        }}
      />
      <span className="mono">{meta.short}</span>
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
        transition: "all var(--transition-fast)",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.125rem 0.375rem",
        background: "var(--bg-elevated)",
        borderRadius: "var(--radius-xs)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)";
        (e.currentTarget as HTMLAnchorElement).style.background = "var(--border-subtle)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)";
        (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-elevated)";
      }}
    >
      <span style={{ color: "var(--text-muted)", fontWeight: 800 }}>{label.toUpperCase()}:</span>
      {hash.slice(0, 6)}…{hash.slice(-4)}
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M7 17L17 7M17 7H7M17 7v10" strokeLinecap="round" strokeLinejoin="round" />
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
      if (d > 0) setLabel(`${d}D`);
      else if (h > 0) setLabel(`${h}H`);
      else if (m > 0) setLabel(`${m}M`);
      else setLabel(`${s}S`);
    }
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [ts]);

  return (
    <span className="mono" style={{ fontSize: "0.625rem", color: "var(--text-muted)", fontWeight: 700 }}>{label}</span>
  );
}

// ── Refresh icon ──────────────────────────────────────────────────────────────

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      style={{ animation: spinning ? "spin 1s linear infinite" : "none" }}
    >
      <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        padding: "1.25rem 1.5rem",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <ChainChip chainId={srcChainId} />
        <ArrowRightIcon />
        <ChainChip chainId={destChainId} />
        <div style={{ flex: 1 }} />
        <StatusBadge status={tx.status} />
        <RelativeTime ts={tx.createdAt} />
      </div>

      {/* Hash links */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <TxLink hash={tx.burnTxHash} chainId={srcChainId} label="Source" />
        {tx.relayTxHash && (
          <TxLink hash={tx.relayTxHash} chainId={destChainId} label="Relay" />
        )}
      </div>

      {tx.status === "failed" && tx.error && (
        <div style={{ padding: "0.5rem", background: "var(--accent-error-muted)", borderRadius: "var(--radius-xs)", border: "1px solid rgba(255, 77, 77, 0.1)" }}>
          <span style={{ fontSize: "0.6875rem", color: "var(--accent-error)", fontWeight: 500 }}>
            {tx.error.slice(0, 100)}
          </span>
        </div>
      )}
    </motion.div>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="3">
      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ connected }: { connected: boolean }) {
  return (
    <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
      <div style={{ width: 48, height: 48, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", display: "flex", alignItems: "center", justifyCenter: "center", margin: "0 auto 1.5rem", borderRadius: "var(--radius-md)" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ margin: "auto" }}>
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
      <p className="label-caps" style={{ color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
        {connected ? "No Data Records" : "Auth Required"}
      </p>
      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
        {connected ? "Your encrypted history is empty." : "Connect wallet to sync history."}
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
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-xl)",
        maxWidth: "480px",
        margin: "0 auto",
        overflow: "hidden",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid var(--border-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--bg-elevated)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: 8, height: 8, background: "var(--accent-primary)" }} />
          <span className="label-caps" style={{ color: "var(--text-primary)" }}>Protocol Ledger</span>
        </div>

        <button
          onClick={() => void load()}
          disabled={loading}
          style={{
            background: "none",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            color: "var(--text-muted)",
            display: "flex",
          }}
        >
          <RefreshIcon spinning={loading} />
        </button>
      </div>

      {/* Content */}
      <div style={{ maxHeight: "500px", overflowY: "auto" }}>
        {!address ? (
          <EmptyState connected={false} />
        ) : loading && txs.length === 0 ? (
          <div style={{ padding: "4rem", display: "flex", justifyContent: "center" }}>
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
        <div style={{ padding: "0.75rem 1.5rem", borderTop: "1px solid var(--border-subtle)", textAlign: "right" }}>
          <span className="mono" style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>
            LAST_SYNC: <RelativeTime ts={lastFetch} />
          </span>
        </div>
      )}
    </motion.div>
  );
}
