"use client";

import { useEffect, useRef, useCallback } from "react";

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

// ── Types mirroring backend/src/types/index.ts ────────────────────────────────

export type RelayStatus =
  | "pending"
  | "attesting"
  | "relaying"
  | "completed"
  | "failed";

export type RelayWsMessage =
  | { type: "status_update"; burnTxHash: string; status: RelayStatus }
  | { type: "relay_complete"; burnTxHash: string; relayTxHash: string; destChainId: number }
  | { type: "relay_failed"; burnTxHash: string; error: string };

export interface RelayRequest {
  burnTxHash: string;
  sourceChainId: number;
  destDomain: number;
  recipient: string;
}

// ── REST helpers ──────────────────────────────────────────────────────────────

/** Register a burn tx with the backend relay service (fire-and-forget). */
export async function postRelay(params: RelayRequest): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/api/bridge/relay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch {
    // Backend unavailable — the event listener will still pick it up
    console.warn("[relay] Could not POST to backend relay service");
  }
}

/** Fetch current relay status for a burn tx (one-shot, for initialising state). */
export async function fetchRelayStatus(
  burnTxHash: string
): Promise<{ status: RelayStatus; relayTxHash?: string } | null> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/bridge/status/${burnTxHash}`
    );
    if (!res.ok) return null;
    return res.json() as Promise<{ status: RelayStatus; relayTxHash?: string }>;
  } catch {
    return null;
  }
}

// ── Local transaction store ───────────────────────────────────────────────────
// Persists every submitted tx hash in localStorage so the history panel always
// shows all attempts — even on-chain failures that never emit an event (and
// thus are never tracked by the backend).

const LOCAL_TX_KEY = "shadowbridge_txs_v1";

interface LocalTxEntry {
  burnTxHash: string;
  sourceChainId: number;
  destDomain: number;
  recipient: string;
  createdAt: number;
}

/** Call this as soon as a tx hash is available (i.e. when status = "mining"). */
export function saveLocalTx(entry: LocalTxEntry): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(LOCAL_TX_KEY) ?? "[]";
    const existing: LocalTxEntry[] = JSON.parse(raw) as LocalTxEntry[];
    const without = existing.filter((e) => e.burnTxHash !== entry.burnTxHash);
    without.unshift(entry);
    localStorage.setItem(LOCAL_TX_KEY, JSON.stringify(without.slice(0, 100)));
  } catch { /* storage unavailable */ }
}

/**
 * For L2→L2 bridges: replace the bridgeOut() placeholder hash with the real
 * onBridgeOutCallback() burn hash when BridgeOutExecuted fires.
 * Matches by recipient + destDomain within a 30-minute window.
 */
export function upgradeLocalTx(
  realEntry: LocalTxEntry,
  within = 30 * 60 * 1000
): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(LOCAL_TX_KEY) ?? "[]";
    const existing: LocalTxEntry[] = JSON.parse(raw) as LocalTxEntry[];
    const filtered = existing.filter((e) => {
      if (e.burnTxHash === realEntry.burnTxHash) return false; // deduplicate exact match
      const isPlaceholder =
        e.recipient.toLowerCase() === realEntry.recipient.toLowerCase() &&
        e.destDomain === realEntry.destDomain &&
        Math.abs(e.createdAt - realEntry.createdAt) < within;
      return !isPlaceholder; // remove the old bridgeOut() placeholder
    });
    filtered.unshift(realEntry);
    localStorage.setItem(LOCAL_TX_KEY, JSON.stringify(filtered.slice(0, 100)));
  } catch { /* storage unavailable */ }
}

function loadLocalTxs(recipient: string): BridgeTx[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_TX_KEY) ?? "[]";
    const entries: LocalTxEntry[] = JSON.parse(raw) as LocalTxEntry[];
    return entries
      .filter((e) => e.recipient.toLowerCase() === recipient.toLowerCase())
      .map((e) => ({
        burnTxHash: e.burnTxHash,
        sourceChainId: e.sourceChainId,
        sourceDomain: 0,
        destDomain: e.destDomain,
        recipient: e.recipient,
        status: "pending" as RelayStatus,
        createdAt: e.createdAt,
        updatedAt: e.createdAt,
      }));
  } catch {
    return [];
  }
}

/** Fetch all bridge transactions for a wallet address.
 *  Merges backend data (authoritative status) with localStorage (covers
 *  on-chain failures and events the backend may have missed). */
export async function fetchHistory(address: string): Promise<BridgeTx[]> {
  const local = loadLocalTxs(address);
  try {
    const res = await fetch(`${BACKEND_URL}/api/bridge/history/${address}`);
    if (!res.ok) return local;
    const backend = (await res.json()) as BridgeTx[];
    const backendHashes = new Set(backend.map((t) => t.burnTxHash.toLowerCase()));

    // For L2→L2 bridges the frontend saves the bridgeOut() hash to localStorage
    // while the backend tracks the onBridgeOutCallback() hash (a different tx).
    // Deduplicate by recipient + destDomain within a 30-minute window so the
    // bridgeOut() placeholder doesn't show as a permanent "pending" ghost entry.
    const TWIN_WINDOW = 30 * 60 * 1000;
    const localOnly = local.filter((localTx) => {
      if (backendHashes.has(localTx.burnTxHash.toLowerCase())) return false;
      const hasTwin = backend.some(
        (bt) =>
          bt.recipient.toLowerCase() === localTx.recipient.toLowerCase() &&
          bt.destDomain === localTx.destDomain &&
          Math.abs(bt.createdAt - localTx.createdAt) < TWIN_WINDOW
      );
      return !hasTwin;
    });

    return [...backend, ...localOnly].sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return local;
  }
}

export interface BridgeTx {
  burnTxHash: string;
  sourceChainId: number;
  sourceDomain: number;
  destDomain: number;
  recipient: string;
  status: RelayStatus;
  relayTxHash?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

// ── WebSocket hook ────────────────────────────────────────────────────────────

const WS_URL = BACKEND_URL.replace(/^http/, "ws");

/**
 * Subscribes to the backend WebSocket and calls `onMessage` whenever a message
 * arrives for `burnTxHash`. Automatically reconnects on unexpected close.
 *
 * Pass `null` as `burnTxHash` to disable (used before a tx is in-flight).
 */
export function useRelaySocket(
  burnTxHash: string | null,
  onMessage: (msg: RelayWsMessage) => void
): void {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(true);

  const connect = useCallback(() => {
    if (!burnTxHash || !active.current) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as RelayWsMessage;
          if (msg.burnTxHash === burnTxHash.toLowerCase()) {
            onMessageRef.current(msg);
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onclose = () => {
        if (!active.current) return;
        // Reconnect after 5 s — relay can take 40 min
        reconnectTimer.current = setTimeout(connect, 5_000);
      };
    } catch {
      // WebSocket not available (SSR, test env, etc.) — silently skip
    }
  }, [burnTxHash]);

  useEffect(() => {
    active.current = true;

    if (!burnTxHash) return;

    connect();

    return () => {
      active.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [burnTxHash, connect]);
}
