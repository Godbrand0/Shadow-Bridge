/**
 * cctp-monitor.ts
 *
 * Core relay service:
 *   1. Extracts the CCTP MessageSent event from a burn tx receipt
 *   2. Polls Circle's Iris V2 API until the attestation is ready (with backoff)
 *   3. Calls receiveAndEncrypt(recipient, message, attestation) on the dest bridge
 *   4. Broadcasts status updates via WebSocket
 *   5. Persists every state change to Supabase (restores in-flight txs on restart)
 */

import axios from "axios";
import { ethers } from "ethers";
import { CHAINS, BY_DOMAIN, BY_CHAIN_ID, IRIS_API_URL, type ChainConfig } from "../config/chains";
import { upsertTx, getTx, getInFlightTxs, getAllTxs } from "./db";
import type { BridgeTx, BridgeStatus, WsMessage } from "../types";

// ── In-memory cache (primary read path; DB is source of truth on restart) ─────

const cache = new Map<string, BridgeTx>();

// ── WebSocket broadcaster injected by server.ts ───────────────────────────────

let broadcast: (msg: WsMessage) => void = () => undefined;

export function setBroadcaster(fn: (msg: WsMessage) => void): void {
  broadcast = fn;
}

// ── Minimal ABIs ──────────────────────────────────────────────────────────────

const BRIDGE_EXECUTED_ABI = [
  "event BridgeExecuted(address indexed user, uint32 destinationDomain)",
];
const BRIDGE_OUT_EXECUTED_ABI = [
  "event BridgeOutExecuted(address indexed user, uint32 destinationDomain)",
];
const RECEIVE_AND_ENCRYPT_ABI = [
  "function receiveAndEncrypt(address recipient, bytes calldata cctpMessage, bytes calldata attestation) external",
];

// CCTP MessageTransmitter — used for L2→L2 routes where mintRecipient is the
// user's wallet, not the destination bridge.
const RECEIVE_MESSAGE_ABI = [
  "function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool)",
];

// keccak256("MessageSent(bytes)")
const MESSAGE_SENT_TOPIC =
  "0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function updateStatus(
  tx: BridgeTx,
  status: BridgeStatus,
  extra?: Partial<BridgeTx>
): Promise<void> {
  tx.status = status;
  tx.updatedAt = Date.now();
  if (extra) Object.assign(tx, extra);
  cache.set(tx.burnTxHash, tx);
  broadcast({ type: "status_update", burnTxHash: tx.burnTxHash, status });
  await upsertTx(tx);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Step 1: Extract MessageSent from burn tx ──────────────────────────────────

async function extractCctpMessage(
  rpcUrls: string[],
  chainId: number,
  txHash: string,
  transmitterAddress: string
): Promise<string> {
  // Retry up to 3x — receipt may not be indexed yet on slow RPCs
  let receipt: ethers.TransactionReceipt | null = null;
  for (let i = 0; i < 3; i++) {
    receipt = await withFallback(rpcUrls, chainId, (p) => p.getTransactionReceipt(txHash));
    if (receipt) break;
    console.log(`[cctp-monitor] Receipt not found for ${txHash}, retrying (${i + 1}/3)...`);
    await sleep(5_000);
  }
  if (!receipt) throw new Error(`Receipt not found for ${txHash} after 3 attempts`);

  const transmitter = transmitterAddress.toLowerCase();
  for (const log of receipt.logs) {
    if (
      log.address.toLowerCase() === transmitter &&
      log.topics[0]?.toLowerCase() === MESSAGE_SENT_TOPIC.toLowerCase()
    ) {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["bytes"], log.data);
      return decoded[0] as string;
    }
  }
  throw new Error(`No MessageSent event found in tx ${txHash}`);
}

// ── Step 2: Poll Circle Iris with exponential backoff ─────────────────────────
// Returns both attestation hex AND the canonical message bytes from Iris.
// Iris message bytes are authoritative for CCTP V2 — event-extracted bytes
// may carry a zero nonce which causes "Invalid signature" on relay.

async function fetchAttestation(
  sourceDomain: number,
  burnTxHash: string
): Promise<{ attestation: string; messageBytes: string | null }> {
  const url = `${IRIS_API_URL}/v2/messages/${sourceDomain}`;

  // Backoff schedule: first 3 polls at 60s (attestation can't exist yet),
  // then 20s intervals — max 40 min total wait.
  const delays: number[] = [
    60_000, 60_000, 60_000,
    ...Array(117).fill(20_000),
  ];

  for (let attempt = 0; attempt < delays.length; attempt++) {
    try {
      const { data } = await axios.get<{
        messages?: Array<{ status: string; attestation: string; message?: string }>;
      }>(url, {
        params: { transactionHash: burnTxHash },
        timeout: 10_000,
      });

      const msg = data.messages?.[0];
      if (msg?.status === "complete" && msg.attestation && msg.attestation !== "PENDING") {
        return {
          attestation: msg.attestation,
          messageBytes: msg.message ?? null,
        };
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 429) {
          console.warn("[cctp-monitor] Iris API rate-limited (429) — waiting 5 min");
          await sleep(300_000);
          continue;
        }
        if (err.response?.status !== 404) {
          console.error("[cctp-monitor] Iris API error:", err.message);
          await sleep(Math.min(delays[attempt]! * 2, 120_000));
          continue;
        }
      }
    }

    if (attempt < delays.length - 1) {
      await sleep(delays[attempt]!);
    }
  }

  throw new Error(`Attestation timed out for ${burnTxHash}`);
}

// ── Step 3: Submit relay on destination chain ─────────────────────────────────
// Returns the relay tx hash, or null if the message was already processed.
//
// Route logic:
//   ETH → L2  (sourceDomain === 0): mintRecipient in the CCTP message is the
//             destination ShadowBridge, so we call receiveAndEncrypt() on it to
//             have the bridge receive the USDC and immediately encrypt it.
//
//   L2  → L2  (sourceDomain !== 0): mintRecipient in the CCTP message is the
//             user's own wallet (set by the frontend in bridgeOut()). Calling
//             receiveAndEncrypt() would revert because:
//               1. _validateCCTPSender checks sender === ethShadowBridge, but
//                  for L2→L2 the CCTP sender is the source L2 bridge.
//               2. Even if that passed, mintedAmount would be 0 (USDC goes to
//                  user's wallet, not the bridge contract).
//             Instead we call receiveMessage() directly on the CCTP
//             MessageTransmitter so USDC lands in the user's wallet on the
//             destination chain.

async function relayToDestination(
  destChain: ChainConfig,
  sourceDomain: number,
  recipient: string,
  messageBytes: string,
  attestation: string
): Promise<string | null> {
  const relayerKey = process.env.RELAYER_PRIVATE_KEY;
  if (!relayerKey) throw new Error("RELAYER_PRIVATE_KEY not set");

  const wallet = await createWallet(destChain.rpcUrls, destChain.chainId, relayerKey);

  const isL2Source = sourceDomain !== 0;

  const alreadyDone = (errMsg: string): boolean => {
    const m = errMsg.toLowerCase();
    return (
      m.includes("nonce already used") ||
      m.includes("already used") ||
      m.includes("already received") ||
      m.includes("message has been processed")
    );
  };

  if (isL2Source) {
    // L2→L2: deliver USDC to user's wallet via the CCTP MessageTransmitter.
    const transmitter = new ethers.Contract(
      destChain.cctpMessageTransmitter,
      RECEIVE_MESSAGE_ABI,
      wallet
    );
    try {
      const tx: ethers.ContractTransactionResponse = await transmitter[
        "receiveMessage(bytes,bytes)"
      ](messageBytes, attestation);
      const receipt = await tx.wait();
      if (!receipt || receipt.status === 0) {
        throw new Error(`receiveMessage reverted (tx: ${tx.hash})`);
      }
      console.log(`[cctp-monitor] receiveMessage success — USDC delivered to ${recipient} on ${destChain.name}`);
      return tx.hash;
    } catch (err) {
      if (alreadyDone((err as Error).message ?? "")) {
        console.log(`[cctp-monitor] receiveMessage: already processed — marking completed`);
        return null;
      }
      throw err;
    }
  }

  // ETH→L2: route through receiveAndEncrypt so the destination bridge
  // receives and immediately FHE-encrypts the minted USDC.
  const destBridge = new ethers.Contract(
    destChain.shadowBridge,
    RECEIVE_AND_ENCRYPT_ABI,
    wallet
  );
  try {
    const tx: ethers.ContractTransactionResponse = await destBridge[
      "receiveAndEncrypt(address,bytes,bytes)"
    ](recipient, messageBytes, attestation);
    const receipt = await tx.wait();
    if (!receipt || receipt.status === 0) {
      throw new Error(`receiveAndEncrypt reverted (tx: ${tx.hash})`);
    }
    return tx.hash;
  } catch (err) {
    if (alreadyDone((err as Error).message ?? "")) {
      console.log(`[cctp-monitor] receiveAndEncrypt: already received by another relayer — marking completed`);
      return null;
    }
    throw err;
  }
}

// ── Core relay pipeline ───────────────────────────────────────────────────────

async function runRelay(tx: BridgeTx): Promise<void> {
  const sourceChain = BY_CHAIN_ID[tx.sourceChainId];
  const destChain = BY_DOMAIN[tx.destDomain];

  if (!sourceChain || !destChain) {
    await updateStatus(tx, "failed", {
      error: `Unknown chain: sourceChainId=${tx.sourceChainId} destDomain=${tx.destDomain}`,
    });
    return;
  }

  try {
    console.log(`[cctp-monitor] Starting relay for ${tx.burnTxHash} (Status: ${tx.status})`);

    // Step 1 — resume from wherever we left off
    if (!tx.messageBytes) {
      const messageBytes = await extractCctpMessage(
        sourceChain.rpcUrls,
        sourceChain.chainId,
        tx.burnTxHash,
        sourceChain.cctpMessageTransmitter
      );
      await updateStatus(tx, "attesting", { messageBytes });
      console.log(`[cctp-monitor] MessageSent extracted for ${tx.burnTxHash}`);
    } else if (tx.status === "pending") {
      await updateStatus(tx, "attesting");
    }

    // Step 2 — get attestation
    if (!tx.attestation) {
      const { attestation, messageBytes: irisMessageBytes } = await fetchAttestation(tx.sourceDomain, tx.burnTxHash);
      // Prefer Iris message bytes (CCTP V2: event bytes may have zero nonce)
      const update: Partial<typeof tx> = { attestation };
      if (irisMessageBytes) update.messageBytes = irisMessageBytes;
      await updateStatus(tx, "relaying", update);
      console.log(`[cctp-monitor] Attestation ready for ${tx.burnTxHash}`);
    } else if (tx.status === "attesting") {
      await updateStatus(tx, "relaying");
    }

    // Step 3 — relay on-chain (null = already received by another relayer)
    const relayTxHash = await relayToDestination(
      destChain,
      tx.sourceDomain,
      tx.recipient,
      tx.messageBytes!,
      tx.attestation!
    );

    await updateStatus(tx, "completed", { relayTxHash: relayTxHash ?? undefined });
    broadcast({
      type: "relay_complete",
      burnTxHash: tx.burnTxHash,
      relayTxHash: relayTxHash ?? "",
      destChainId: destChain.chainId,
    });
    console.log(
      `[cctp-monitor] Relay complete for ${tx.burnTxHash}${relayTxHash ? ` — relay tx: ${relayTxHash}` : " (already received)"}`
    );
  } catch (err) {
    const error = (err as Error).message ?? "Unknown error";
    await updateStatus(tx, "failed", { error });
    broadcast({ type: "relay_failed", burnTxHash: tx.burnTxHash, error });
    console.error(`[cctp-monitor] Relay failed for ${tx.burnTxHash}:`, error);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getAll(): BridgeTx[] {
  return [...cache.values()];
}

export function getOne(burnTxHash: string): BridgeTx | undefined {
  return cache.get(burnTxHash.toLowerCase());
}

/**
 * Begin monitoring a CCTP burn and relay it to the destination ShadowBridge.
 * State is persisted to Supabase so it survives backend restarts.
 */
export async function monitorAndRelay(
  burnTxHash: string,
  sourceChainId: number,
  destDomain: number,
  recipient: string
): Promise<void> {
  console.log(`[cctp-monitor] monitorAndRelay called for ${burnTxHash} (Source: ${sourceChainId}, DestDomain: ${destDomain})`);
  const key = burnTxHash.toLowerCase();

  if (cache.has(key)) {
    console.log(`[cctp-monitor] Already tracking ${key}`);
    return;
  }

  // Check DB in case we restarted
  const existing = await getTx(key);
  if (existing) {
    if (existing.status === "completed" || existing.status === "failed") {
      cache.set(key, existing);
      return;
    }
    cache.set(key, existing);
    void runRelay(existing);
    return;
  }

  const sourceChain = BY_CHAIN_ID[sourceChainId];
  if (!sourceChain) throw new Error(`Unknown source chain ID ${sourceChainId}`);
  const destChain = BY_DOMAIN[destDomain];
  if (!destChain) throw new Error(`Unknown destination domain ${destDomain}`);

  const tx: BridgeTx = {
    burnTxHash: key,
    sourceChainId,
    sourceDomain: sourceChain.domain,
    destDomain,
    recipient: recipient.toLowerCase(),
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  cache.set(key, tx);
  await upsertTx(tx);

  void runRelay(tx);
}

/**
 * Retry a previously failed relay.
 */
export async function retryRelay(burnTxHash: string): Promise<void> {
  const key = burnTxHash.toLowerCase();
  const tx = cache.get(key);
  if (!tx) throw new Error(`No tracked tx for ${key}`);
  if (tx.status !== "failed") throw new Error(`Tx ${key} is not in failed state`);

  tx.status = "pending";
  tx.error = undefined;
  tx.updatedAt = Date.now();
  await upsertTx(tx);

  void runRelay(tx);
}

/**
 * On startup: reload any in-flight txs from Supabase and resume them.
 * Also seeds the in-memory cache from DB so status queries work immediately.
 */
export async function resumeInFlightTxs(): Promise<void> {
  console.log("[cctp-monitor] Checking for in-flight transactions in DB...");
  const inFlight = await getInFlightTxs();
  if (inFlight.length === 0) {
    console.log("[cctp-monitor] No in-flight transactions found in DB.");
    return;
  }

  console.log(`[cctp-monitor] Resuming ${inFlight.length} in-flight tx(s) from DB`);
  for (const tx of inFlight) {
    cache.set(tx.burnTxHash, tx);
    void runRelay(tx);
  }
}

// ── On-chain event watchers ───────────────────────────────────────────────────
// Uses block-range polling (eth_getLogs) instead of eth_newFilter subscriptions,
// which are blocked or unreliable on most free-tier public RPCs.

// How many blocks to look back on startup so events emitted while the
// backend was down are not permanently lost. Configurable per chain.
const LOOKBACK: Record<number, number> = {
  11155111: 600,   // ETH Sepolia  ~12s blocks → ~2 h
  84532:    10000, // Base Sepolia  ~2s blocks → ~5.5 h
  421614:   28800, // Arb Sepolia  ~0.25s blocks → ~2 h
};
const DEFAULT_LOOKBACK = 500;

interface WatchConfig {
  chain: ChainConfig;
  eventName: string;
  abi: string[];
  pollMs: number;
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message || err.toString();
  if (typeof err === "object" && err !== null) {
    const e = err as Record<string, unknown>;
    return String(e["shortMessage"] ?? e["message"] ?? e["code"] ?? JSON.stringify(err));
  }
  return String(err);
}

function isRpcError(err: unknown): boolean {
  const m = errMsg(err).toLowerCase();
  return (
    m.includes("502") ||
    m.includes("503") ||
    m.includes("504") ||
    m.includes("bad gateway") ||
    m.includes("service unavailable") ||
    m.includes("econnrefused") ||
    m.includes("timeout") ||
    m.includes("server_error") ||
    m.includes("server error")
  );
}

/**
 * Try each URL in `rpcUrls` in order, returning the first provider that
 * successfully executes `fn`. Falls back to the next URL on any 5xx / network
 * error. Throws the last error if every URL fails.
 */
async function withFallback<T>(
  rpcUrls: string[],
  chainId: number,
  fn: (provider: ethers.JsonRpcProvider) => Promise<T>
): Promise<T> {
  const network = ethers.Network.from(chainId);
  let lastErr: unknown;
  for (const url of rpcUrls) {
    const provider = new ethers.JsonRpcProvider(url, network, { staticNetwork: network });
    try {
      return await fn(provider);
    } catch (err) {
      lastErr = err;
      if (isRpcError(err)) {
        console.warn(`[cctp-monitor] RPC ${url} failed (${errMsg(err).slice(0, 100)}), trying next…`);
        continue;
      }
      // Non-transport errors (revert, bad params, etc.) — don't retry
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Create a signing wallet, trying each RPC URL until one responds.
 * Used for relay write transactions.
 */
async function createWallet(
  rpcUrls: string[],
  chainId: number,
  privateKey: string
): Promise<ethers.Wallet> {
  const network = ethers.Network.from(chainId);
  for (const url of rpcUrls) {
    try {
      const provider = new ethers.JsonRpcProvider(url, network, { staticNetwork: network });
      await provider.getBlockNumber(); // verify connectivity
      return new ethers.Wallet(privateKey, provider);
    } catch {
      console.warn(`[cctp-monitor] Wallet RPC ${url} unreachable, trying next…`);
    }
  }
  // Last resort: connect to primary without a connectivity check
  const provider = new ethers.JsonRpcProvider(rpcUrls[0], network, { staticNetwork: network });
  return new ethers.Wallet(privateKey, provider);
}

async function pollEvents(cfg: WatchConfig): Promise<void> {
  const { chain } = cfg;
  const MAX_BLOCK_RANGE = 2000;
  const lookback = LOOKBACK[chain.chainId] ?? DEFAULT_LOOKBACK;

  // Start LOOKBACK blocks behind the tip so events emitted while the backend
  // was restarting are not permanently missed.
  let lastBlock = 0;
  try {
    const tip = await withFallback(chain.rpcUrls, chain.chainId, (p) => p.getBlockNumber());
    lastBlock = Math.max(0, tip - lookback);
  } catch { /* start from block 0 — poller will catch up */ }

  console.log(
    `[cctp-monitor] Listening ${cfg.eventName} on ${chain.name} ` +
    `from block ${lastBlock} (lookback=${lookback})`
  );

  const tick = async () => {
    try {
      const current = await withFallback(chain.rpcUrls, chain.chainId, (p) => p.getBlockNumber());
      if (current <= lastBlock) return;

      const toBlock = Math.min(current, lastBlock + MAX_BLOCK_RANGE);

      const events = await withFallback(chain.rpcUrls, chain.chainId, async (provider) => {
        const contract = new ethers.Contract(chain.shadowBridge, cfg.abi, provider);
        return contract.queryFilter(cfg.eventName, lastBlock + 1, toBlock) as Promise<ethers.EventLog[]>;
      });

      if (events.length > 0) {
        console.log(`[cctp-monitor] Found ${events.length} new ${cfg.eventName} events on ${chain.name}`);
      }

      for (const ev of events) {
        const [user, destinationDomain] = ev.args as unknown as [string, bigint];
        console.log(
          `[cctp-monitor] ${cfg.eventName} on ${chain.name} — ` +
          `user=${user} dest=${destinationDomain} tx=${ev.transactionHash}`
        );
        void monitorAndRelay(ev.transactionHash, chain.chainId, Number(destinationDomain), user);
      }
      lastBlock = toBlock;
    } catch (err) {
      console.error(`[cctp-monitor] Poll error on ${chain.name} (all RPCs failed):`, errMsg(err));
    }
  };

  // Run immediately so we don't wait one full pollMs before the first scan.
  void tick();
  setInterval(() => { void tick(); }, cfg.pollMs);
}

export function startEventListeners(): void {
  void pollEvents({
    chain: CHAINS.ETH_SEPOLIA,
    eventName: "BridgeExecuted",
    abi: BRIDGE_EXECUTED_ABI,
    pollMs: 12_000,
  });

  void pollEvents({
    chain: CHAINS.BASE_SEPOLIA,
    eventName: "BridgeOutExecuted",
    abi: BRIDGE_OUT_EXECUTED_ABI,
    pollMs: 3_000,
  });

  void pollEvents({
    chain: CHAINS.ARB_SEPOLIA,
    eventName: "BridgeOutExecuted",
    abi: BRIDGE_OUT_EXECUTED_ABI,
    pollMs: 3_000,
  });
}
