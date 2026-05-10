import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { ethers } from "ethers";
import { WebSocketServer, WebSocket } from "ws";
import bridgeRoutes from "./routes/bridge.routes";
import { setBroadcaster, startEventListeners, resumeInFlightTxs } from "./services/cctp-monitor";
import { BY_CHAIN_ID } from "./config/chains";
import type { WsMessage } from "./types";

const PORT = Number(process.env.PORT ?? 3001);

// ── Express app ───────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// ── Health check with relayer wallet balances ─────────────────────────────────

app.get("/health", async (_req, res) => {
  const relayerKey = process.env.RELAYER_PRIVATE_KEY;
  const balances: Record<string, string | null> = {};

  if (relayerKey) {
    const relayerAddress = new ethers.Wallet(relayerKey).address;
    await Promise.all(
      Object.values(BY_CHAIN_ID).map(async (chain) => {
        for (const url of chain.rpcUrls) {
          try {
            const provider = new ethers.JsonRpcProvider(url);
            const bal = await provider.getBalance(relayerAddress);
            balances[chain.name] = ethers.formatEther(bal);
            break;
          } catch {
            // try next URL
          }
        }
        if (!(chain.name in balances)) balances[chain.name] = null;
      })
    );
  }

  const hasLowBalance = Object.values(balances).some(
    (b) => b !== null && parseFloat(b) < 0.01
  );

  res.json({
    ok: !hasLowBalance,
    ts: Date.now(),
    relayerBalances: balances,
    warning: hasLowBalance ? "Relayer wallet balance below 0.01 ETH on one or more chains" : undefined,
  });
});

app.use("/api/bridge", bridgeRoutes);

// ── HTTP + WebSocket server ───────────────────────────────────────────────────

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcast(msg: WsMessage): void {
  const payload = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

wss.on("connection", (ws) => {
  console.log("[ws] Client connected");
  ws.on("close", () => console.log("[ws] Client disconnected"));
});

setBroadcaster(broadcast);

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, async () => {
  console.log(`[server] ShadowBridge backend listening on port ${PORT}`);

  if (!process.env.RELAYER_PRIVATE_KEY) {
    console.warn("[server] WARNING: RELAYER_PRIVATE_KEY not set — relay transactions will fail");
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.warn("[server] WARNING: Supabase not configured — relay state is in-memory only");
  }

  startEventListeners();
  await resumeInFlightTxs();
});
