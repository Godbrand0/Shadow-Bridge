import { Router, Request, Response } from "express";
import { monitorAndRelay, retryRelay, getAll, getOne } from "../services/cctp-monitor";
import { getTxsByRecipient, getAllTxs } from "../services/db";
import type { RelayRequest } from "../types";

const router = Router();

/**
 * POST /api/bridge/relay
 *
 * Manually kick off monitoring for a burn tx (useful when the automatic
 * event listener missed it or for testing).
 *
 * Body: { burnTxHash, sourceChainId, destDomain, recipient }
 */
router.post("/relay", async (req: Request, res: Response): Promise<void> => {
  const { burnTxHash, sourceChainId, destDomain, recipient } = req.body as RelayRequest;

  console.log(`[api] POST /relay for ${burnTxHash} (from chain ${sourceChainId} to domain ${destDomain})`);

  if (!burnTxHash || !sourceChainId || destDomain == null || !recipient) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    void monitorAndRelay(burnTxHash, Number(sourceChainId), Number(destDomain), recipient);
    res.json({ ok: true, burnTxHash: burnTxHash.toLowerCase() });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/bridge/retry/:txHash
 *
 * Retry a relay that ended in "failed" status.
 */
router.post("/retry/:txHash", async (req: Request, res: Response): Promise<void> => {
  const { txHash } = req.params;
  if (!txHash) {
    res.status(400).json({ error: "Missing txHash param" });
    return;
  }

  try {
    await retryRelay(txHash);
    res.json({ ok: true, burnTxHash: txHash.toLowerCase() });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/bridge/status/:txHash
 *
 * Get the current relay status for a burn tx.
 * Checks in-memory cache first, then falls back to Supabase.
 */
router.get("/status/:txHash", (req: Request, res: Response): void => {
  const { txHash } = req.params;
  if (!txHash) {
    res.status(400).json({ error: "Missing txHash param" });
    return;
  }

  const tx = getOne(txHash);
  if (!tx) {
    res.status(404).json({ error: "Transaction not tracked" });
    return;
  }

  res.json(tx);
});

/**
 * GET /api/bridge/history/:address
 *
 * Return all bridge transactions for a given wallet address (newest first).
 * Queries Supabase — returns historical data even across restarts.
 */
router.get("/history/:address", async (req: Request, res: Response): Promise<void> => {
  const { address } = req.params;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }

  try {
    const txs = await getTxsByRecipient(address);

    // Merge with live cache so in-progress txs reflect latest status
    const merged = txs.map((dbTx) => {
      const live = getOne(dbTx.burnTxHash);
      return live ?? dbTx;
    });

    // Also include any cache-only entries not yet in DB (very recent)
    const dbHashes = new Set(merged.map((t) => t.burnTxHash));
    for (const liveTx of getAll()) {
      if (
        liveTx.recipient.toLowerCase() === address.toLowerCase() &&
        !dbHashes.has(liveTx.burnTxHash)
      ) {
        merged.unshift(liveTx);
      }
    }

    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/bridge/pending
 *
 * List all transactions that have not yet completed.
 */
router.get("/pending", (_req: Request, res: Response): void => {
  const pending = getAll().filter((t) => t.status !== "completed");
  res.json(pending);
});

/**
 * GET /api/bridge/all
 *
 * List all tracked transactions from Supabase (admin endpoint).
 */
router.get("/all", async (_req: Request, res: Response): Promise<void> => {
  try {
    const txs = await getAllTxs();
    res.json(txs.length > 0 ? txs : getAll());
  } catch {
    res.json(getAll());
  }
});

export default router;
