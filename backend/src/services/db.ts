/**
 * db.ts
 *
 * Supabase persistence layer for bridge_transactions.
 * Falls back gracefully if SUPABASE_URL / SUPABASE_SERVICE_KEY are not set
 * (e.g. during local dev without a Supabase project) — the monitor will
 * use an in-memory Map as a secondary source in that case.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BridgeTx, BridgeStatus } from "../types";

// ── Client ────────────────────────────────────────────────────────────────────

let _client: SupabaseClient | null = null;

function client(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.warn(
      "[db] SUPABASE_URL or SUPABASE_SERVICE_KEY not set — running without DB persistence"
    );
    return null;
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

// ── Row ↔ Domain type helpers ─────────────────────────────────────────────────

type Row = {
  burn_tx_hash: string;
  source_chain_id: number;
  source_domain: number;
  dest_domain: number;
  recipient: string;
  status: BridgeStatus;
  relay_tx_hash: string | null;
  error: string | null;
  message_bytes: string | null;
  attestation: string | null;
  created_at: string;
  updated_at: string;
};

function rowToTx(row: Row): BridgeTx {
  return {
    burnTxHash: row.burn_tx_hash,
    sourceChainId: row.source_chain_id,
    sourceDomain: row.source_domain,
    destDomain: row.dest_domain,
    recipient: row.recipient,
    status: row.status,
    relayTxHash: row.relay_tx_hash ?? undefined,
    error: row.error ?? undefined,
    messageBytes: row.message_bytes ?? undefined,
    attestation: row.attestation ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function txToRow(tx: BridgeTx): Omit<Row, "created_at" | "updated_at"> & { created_at: string; updated_at: string } {
  return {
    burn_tx_hash: tx.burnTxHash,
    source_chain_id: tx.sourceChainId,
    source_domain: tx.sourceDomain,
    dest_domain: tx.destDomain,
    recipient: tx.recipient.toLowerCase(),
    status: tx.status,
    relay_tx_hash: tx.relayTxHash ?? null,
    error: tx.error ?? null,
    message_bytes: tx.messageBytes ?? null,
    attestation: tx.attestation ?? null,
    created_at: new Date(tx.createdAt).toISOString(),
    updated_at: new Date(tx.updatedAt).toISOString(),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Insert or update a bridge tx record. */
export async function upsertTx(tx: BridgeTx): Promise<void> {
  const db = client();
  if (!db) return;

  const { error } = await db
    .from("bridge_transactions")
    .upsert(txToRow(tx), { onConflict: "burn_tx_hash" });

  if (error) {
    console.error("[db] upsertTx error:", error.message);
  }
}

/** Fetch a single tx by burn hash. Returns null if not found or DB unavailable. */
export async function getTx(burnTxHash: string): Promise<BridgeTx | null> {
  const db = client();
  if (!db) return null;

  const { data, error } = await db
    .from("bridge_transactions")
    .select("*")
    .eq("burn_tx_hash", burnTxHash.toLowerCase())
    .single();

  if (error || !data) return null;
  return rowToTx(data as Row);
}

/** Return all txs for a given recipient address (newest first, up to 50). */
export async function getTxsByRecipient(recipient: string): Promise<BridgeTx[]> {
  const db = client();
  if (!db) return [];

  const { data, error } = await db
    .from("bridge_transactions")
    .select("*")
    .eq("recipient", recipient.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];
  return (data as Row[]).map(rowToTx);
}

/** Return all txs that are still in-flight (pending / attesting / relaying). */
export async function getInFlightTxs(): Promise<BridgeTx[]> {
  const db = client();
  if (!db) return [];

  const { data, error } = await db
    .from("bridge_transactions")
    .select("*")
    .in("status", ["pending", "attesting", "relaying"]);

  if (error || !data) return [];
  return (data as Row[]).map(rowToTx);
}

/** Return all tracked txs (for the /all admin endpoint). */
export async function getAllTxs(): Promise<BridgeTx[]> {
  const db = client();
  if (!db) return [];

  const { data, error } = await db
    .from("bridge_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) return [];
  return (data as Row[]).map(rowToTx);
}
