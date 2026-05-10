"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWatchContractEvent,
  useSwitchChain,
} from "wagmi";
import { maxUint256 } from "viem";
import { ETH_CHAIN, BASE_CHAIN, ARB_CHAIN } from "@/lib/chains";
import { ADDRESSES, ERC20_ABI, ETH_BRIDGE_ABI, DEST_BRIDGE_ABI } from "@/lib/contracts";
import { encryptUsdcAmount, formatUsdc, isDemoMode } from "@/lib/fhevm";
import { postRelay, saveLocalTx, upgradeLocalTx, useRelaySocket, type RelayWsMessage } from "@/lib/relay";
import { TransactionStatus, TxState } from "./TransactionStatus";

// ── Types & Data ──────────────────────────────────────────────────────────────

interface ChainData {
  id: number;
  name: string;
  shortName: string;
  color: string;
  bridge: `0x${string}`;
  usdc: `0x${string}`;
  domain: number;
  isL2: boolean;
}

const CHAINS: ChainData[] = [
  {
    id: ETH_CHAIN.id,
    name: "Ethereum Sepolia",
    shortName: "ETH",
    color: "var(--accent-eth)",
    bridge: ADDRESSES.ethBridge,
    usdc: ADDRESSES.usdcSepolia,
    domain: 0,
    isL2: false,
  },
  {
    id: BASE_CHAIN.id,
    name: "Base Sepolia",
    shortName: "BASE",
    color: "var(--accent-base)",
    bridge: ADDRESSES.baseBridge,
    usdc: ADDRESSES.usdcBase,
    domain: 6,
    isL2: true,
  },
  {
    id: ARB_CHAIN.id,
    name: "Arbitrum Sepolia",
    shortName: "ARB",
    color: "var(--accent-arb)",
    bridge: ADDRESSES.arbBridge,
    usdc: ADDRESSES.usdcArb,
    domain: 3,
    isL2: true,
  },
];

const VALID_DESTINATIONS: Record<number, number[]> = {
  [ETH_CHAIN.id]: [BASE_CHAIN.id, ARB_CHAIN.id],
  [BASE_CHAIN.id]: [ARB_CHAIN.id],
  [ARB_CHAIN.id]: [BASE_CHAIN.id],
};

function friendlyError(err: unknown): string {
  const msg = (err as Error)?.message ?? "Transaction failed";
  if (msg.includes("User rejected") || msg.includes("user rejected"))
    return "Transaction rejected in wallet";
  if (msg.includes("Requested resource not available") || msg.includes("chain: undefined"))
    return "Wallet not connected to the right network — switch chains and retry";
  if (msg.includes("FHE encryption failed"))
    return "FHE encryption failed — is the relayer reachable?";
  if (msg.includes("insufficient funds")) return "Insufficient funds for gas";
  return msg.slice(0, 90) || "Transaction failed";
}

// ── Arrow icon ────────────────────────────────────────────────────────────────

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── ChainSelector ─────────────────────────────────────────────────────────────

function ChainSelector({
  label,
  selectedId,
  onSelect,
  availableIds,
}: {
  label: string;
  selectedId: number;
  onSelect: (id: number) => void;
  availableIds: number[];
}) {
  const selected = CHAINS.find((c) => c.id === selectedId)!;

  return (
    <div style={{ flex: 1 }}>
      <p className="label-caps" style={{ marginBottom: "0.5rem" }}>{label}</p>
      <div style={{ position: "relative" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            padding: "0.75rem 0.875rem",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
            transition: "border-color var(--transition-fast)",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-strong)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-default)")}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "2px",
              background: selected.color,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              flex: 1,
              letterSpacing: "-0.01em",
            }}
          >
            {selected.shortName}
          </span>
          <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{ opacity: 0.4, flexShrink: 0 }} aria-hidden>
            <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <select
            value={selectedId}
            onChange={(e) => onSelect(Number(e.target.value))}
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0,
              cursor: "pointer",
              width: "100%",
            }}
            aria-label={`Select ${label.toLowerCase()} chain`}
          >
            {CHAINS.filter((c) => availableIds.includes(c.id)).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Demo banner ───────────────────────────────────────────────────────────────

function DemoBanner() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.625rem",
        padding: "0.75rem 0.875rem",
        background: "var(--accent-warning-muted)",
        border: "1px solid rgba(245, 158, 11, 0.22)",
        borderRadius: "var(--radius-md)",
        marginBottom: "1rem",
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--accent-warning)",
          flexShrink: 0,
          marginTop: 3,
          animation: "pulse 1.6s ease-in-out infinite",
        }}
      />
      <p style={{ fontSize: "0.75rem", color: "var(--accent-warning)", lineHeight: 1.55 }}>
        <strong>Demo mode</strong> — Zama relayer unreachable. Encryption uses placeholder
        ciphertexts; bridge transactions will not succeed on-chain.
      </p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function UnifiedBridgePanel() {
  const { address, chainId: currentChainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [fromId, setFromId] = useState<number>(ETH_CHAIN.id);
  const [toId, setToId] = useState<number>(BASE_CHAIN.id);
  const [amount, setAmount] = useState("");
  const [txState, setTxState] = useState<TxState>({ status: "idle" });
  const [showDemoWarning, setShowDemoWarning] = useState(false);

  const [activeBurnTxHash, _setActiveBurnTxHash] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("sb_active_burn_tx");
  });

  const setActiveBurnTxHash = useCallback((hash: string | null) => {
    _setActiveBurnTxHash(hash);
    if (typeof window === "undefined") return;
    if (hash) sessionStorage.setItem("sb_active_burn_tx", hash);
    else sessionStorage.removeItem("sb_active_burn_tx");
  }, []);

  const fromChain = CHAINS.find((c) => c.id === fromId)!;
  const toChain = CHAINS.find((c) => c.id === toId)!;
  const isRightChain = currentChainId === fromId;

  useEffect(() => {
    const validTo = VALID_DESTINATIONS[fromId] || [];
    if (!validTo.includes(toId)) setToId(validTo[0] || ETH_CHAIN.id);
  }, [fromId, toId]);

  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !activeBurnTxHash) return;
    restoredRef.current = true;
    import("@/lib/relay").then(({ fetchRelayStatus }) =>
      fetchRelayStatus(activeBurnTxHash).then((st) => {
        if (!st) return;
        if (st.status === "completed" && st.relayTxHash) {
          setActiveBurnTxHash(null);
          setTxState({ status: "relay_complete", relayTxHash: st.relayTxHash, destChainId: 0 });
        } else if (st.status === "failed") {
          setActiveBurnTxHash(null);
          setTxState({ status: "error", message: "Previous relay failed — check History tab" });
        } else {
          setTxState({ status: "relay_attesting", burnTxHash: activeBurnTxHash });
        }
      })
    );
  }, [activeBurnTxHash, setActiveBurnTxHash]);

  useEffect(() => {
    isDemoMode().then(setShowDemoWarning);
  }, []);

  const { data: ethBal, refetch: refEth } = useReadContract({ address: ADDRESSES.usdcSepolia, abi: ERC20_ABI, functionName: "balanceOf", args: [address!], chainId: ETH_CHAIN.id, query: { enabled: !!address } });
  const { data: baseBal, refetch: refBase } = useReadContract({ address: ADDRESSES.usdcBase, abi: ERC20_ABI, functionName: "balanceOf", args: [address!], chainId: BASE_CHAIN.id, query: { enabled: !!address } });
  const { data: arbBal, refetch: refArb } = useReadContract({ address: ADDRESSES.usdcArb, abi: ERC20_ABI, functionName: "balanceOf", args: [address!], chainId: ARB_CHAIN.id, query: { enabled: !!address } });

  const { data: pETH } = useReadContract({ address: ADDRESSES.ethBridge, abi: ETH_BRIDGE_ABI, functionName: "hasPendingBridge", args: [address!], chainId: ETH_CHAIN.id, query: { enabled: !!address } });
  const { data: pBB } = useReadContract({ address: ADDRESSES.baseBridge, abi: DEST_BRIDGE_ABI, functionName: "hasPendingBridge", args: [address!], chainId: BASE_CHAIN.id, query: { enabled: !!address } });
  const { data: pAB } = useReadContract({ address: ADDRESSES.arbBridge, abi: DEST_BRIDGE_ABI, functionName: "hasPendingBridge", args: [address!], chainId: ARB_CHAIN.id, query: { enabled: !!address } });

  const isPending = useMemo(() => {
    if (fromId === ETH_CHAIN.id) return !!pETH;
    if (fromId === BASE_CHAIN.id) return !!pBB;
    if (fromId === ARB_CHAIN.id) return !!pAB;
    return false;
  }, [fromId, pETH, pBB, pAB]);

  const balance = useMemo(() => {
    if (fromId === ETH_CHAIN.id) return ethBal;
    if (fromId === BASE_CHAIN.id) return baseBal;
    if (fromId === ARB_CHAIN.id) return arbBal;
    return 0n;
  }, [fromId, ethBal, baseBal, arbBal]);

  const handleRelayMessage = useCallback((msg: RelayWsMessage) => {
    if (msg.type === "status_update") {
      if (msg.status === "attesting") {
        setTxState({ status: "relay_attesting", burnTxHash: msg.burnTxHash });
      } else if (msg.status === "relaying") {
        setTxState({ status: "relay_relaying", burnTxHash: msg.burnTxHash });
      }
    } else if (msg.type === "relay_complete") {
      setActiveBurnTxHash(null);
      setTxState({
        status: "relay_complete",
        relayTxHash: msg.relayTxHash,
        destChainId: msg.destChainId,
      });
      void refEth(); void refBase(); void refArb();
    } else if (msg.type === "relay_failed") {
      setActiveBurnTxHash(null);
      setTxState({ status: "error", message: `Relay failed: ${msg.error}` });
    }
  }, [refEth, refBase, refArb, setActiveBurnTxHash]);

  useRelaySocket(activeBurnTxHash, handleRelayMessage);

  useWatchContractEvent({
    address: fromChain.bridge,
    abi: ETH_BRIDGE_ABI,
    eventName: "BridgeExecuted",
    chainId: ETH_CHAIN.id,
    onLogs(logs) {
      if (fromId !== ETH_CHAIN.id) return;
      const log = logs[0];
      if (!log) return;
      const burnTxHash = log.transactionHash;
      if (!burnTxHash) return;
      setActiveBurnTxHash(burnTxHash);
      setTxState({ status: "relay_attesting", burnTxHash });
      void postRelay({
        burnTxHash,
        sourceChainId: ETH_CHAIN.id,
        destDomain: toChain.domain,
        recipient: address ?? "",
      });
    },
  });

  useWatchContractEvent({
    address: fromChain.bridge,
    abi: DEST_BRIDGE_ABI,
    eventName: "BridgeOutExecuted",
    args: address ? { user: address } : undefined,
    chainId: fromId,
    onLogs(logs) {
      if (!fromChain.isL2) return;
      const log = logs[0];
      if (!log) return;
      const burnTxHash = log.transactionHash;
      if (!burnTxHash) return;
      // Replace the bridgeOut() placeholder in localStorage with the real burn tx hash
      upgradeLocalTx({
        burnTxHash,
        sourceChainId: fromId,
        destDomain: toChain.domain,
        recipient: address ?? "",
        createdAt: Date.now(),
      });
      setActiveBurnTxHash(burnTxHash);
      setTxState({ status: "relay_attesting", burnTxHash });
      void postRelay({
        burnTxHash,
        sourceChainId: fromId,
        destDomain: toChain.domain,
        recipient: address ?? "",
      });
    },
  });

  const handleBridge = async () => {
    if (!address || !amount || !isRightChain) return;
    const num = parseFloat(amount);
    try {
      setTxState({ status: "encrypting" });
      const { handle, inputProof } = await encryptUsdcAmount(num, fromChain.bridge, address);

      if (fromId === ETH_CHAIN.id) {
        setTxState({ status: "pending", description: "Approving USDC…" });
        const app = await writeContractAsync({ address: fromChain.usdc, abi: ERC20_ABI, functionName: "approve", args: [fromChain.bridge, maxUint256], chainId: fromId });
        setTxState({ status: "mining", hash: app, chainId: fromId });
        await new Promise((r) => setTimeout(r, 2000));
        setTxState({ status: "pending", description: "Initiating Bridge…" });
        const tx = await writeContractAsync({ address: fromChain.bridge, abi: ETH_BRIDGE_ABI, functionName: "depositConfidential", args: [handle, inputProof, toChain.domain], chainId: fromId, gas: 1_000_000n });
        saveLocalTx({ burnTxHash: tx, sourceChainId: fromId, destDomain: toChain.domain, recipient: address, createdAt: Date.now() });
        setTxState({ status: "mining", hash: tx, chainId: fromId });
      } else {
        setTxState({ status: "pending", description: "Initiating L2 Bridge…" });
        const recp = ("0x" + address.slice(2).padStart(64, "0")) as `0x${string}`;
        const tx = await writeContractAsync({ address: fromChain.bridge, abi: DEST_BRIDGE_ABI, functionName: "bridgeOut", args: [handle, inputProof, toChain.domain, recp], chainId: fromId, gas: 1_000_000n });
        saveLocalTx({ burnTxHash: tx, sourceChainId: fromId, destDomain: toChain.domain, recipient: address, createdAt: Date.now() });
        setTxState({ status: "mining", hash: tx, chainId: fromId });
      }
    } catch (err: unknown) {
      setTxState({ status: "error", message: friendlyError(err) });
    }
  };

  const canBridge = address && isRightChain && amount && !isPending && txState.status === "idle";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-2xl)",
        padding: "1.5rem",
        maxWidth: "460px",
        margin: "0 auto",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {showDemoWarning && <DemoBanner />}

      {/* Chain selectors */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <ChainSelector
          label="From"
          selectedId={fromId}
          onSelect={setFromId}
          availableIds={CHAINS.map((c) => c.id)}
        />
        <div
          style={{
            paddingBottom: "0.8rem",
            color: "var(--text-muted)",
            flexShrink: 0,
          }}
          aria-hidden
        >
          <ArrowRight />
        </div>
        <ChainSelector
          label="To"
          selectedId={toId}
          onSelect={setToId}
          availableIds={VALID_DESTINATIONS[fromId] || []}
        />
      </div>

      {/* Amount input */}
      <div
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: "1rem 1.125rem",
          marginBottom: "1rem",
          transition: "border-color var(--transition-fast)",
        }}
        onFocusCapture={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-focus)";
        }}
        onBlurCapture={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-default)";
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.625rem",
          }}
        >
          <span className="label-caps">Amount</span>
          <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
            Balance:{" "}
            <span className="mono" style={{ color: "var(--text-secondary)" }}>
              {balance ? formatUsdc(balance as bigint) : "0.00"}
            </span>{" "}
            <span style={{ color: "var(--text-muted)" }}>USDC</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
          <input
            type="number"
            placeholder="0.00"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || parseFloat(v) >= 0) setAmount(v);
            }}
            className="mono"
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              fontSize: "2.25rem",
              fontWeight: 400,
              color: "var(--text-primary)",
              minWidth: 0,
              letterSpacing: "-0.03em",
            }}
            aria-label="Bridge amount in USDC"
          />
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--text-muted)",
              flexShrink: 0,
              letterSpacing: "0.02em",
            }}
          >
            USDC
          </span>
        </div>
      </div>

      {/* CTA */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {!address ? (
          <p
            style={{
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "0.875rem",
              padding: "1rem 0",
              letterSpacing: "-0.01em",
            }}
          >
            Connect wallet to continue
          </p>
        ) : !isRightChain ? (
          <button
            onClick={() => switchChain?.({ chainId: fromId })}
            className="btn btn-secondary"
            style={{ width: "100%", padding: "0.875rem" }}
          >
            Switch to {fromChain.name}
          </button>
        ) : (
          <button
            onClick={handleBridge}
            disabled={!canBridge}
            className="btn btn-primary"
            style={{ width: "100%", padding: "0.875rem" }}
          >
            {isPending ? "Waiting for FHE Callback…" : `Bridge to ${toChain.shortName}`}
          </button>
        )}
      </div>

      <TransactionStatus state={txState} onReset={() => setTxState({ status: "idle" })} />

      {/* Footer metadata */}
      <div
        style={{
          marginTop: "1.25rem",
          paddingTop: "1.25rem",
          borderTop: "1px solid var(--border-subtle)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
        }}
      >
        <div>
          <p className="label-caps" style={{ marginBottom: "0.3125rem" }}>Privacy</p>
          <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
            FHE handles keep amounts encrypted on-chain.
          </p>
        </div>
        <div>
          <p className="label-caps" style={{ marginBottom: "0.3125rem" }}>Liquidity</p>
          <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
            Circle CCTP V2 for slippage-free bridging.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
