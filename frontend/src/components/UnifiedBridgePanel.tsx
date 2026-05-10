"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  icon: string;
  bridge: `0x${string}`;
  usdc: `0x${string}`;
  domain: number;
  isL2: boolean;
}

const CHAINS: ChainData[] = [
  {
    id: ETH_CHAIN.id,
    name: "Ethereum Sepolia",
    shortName: "Sepolia",
    color: "#627EEA",
    icon: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
    bridge: ADDRESSES.ethBridge,
    usdc: ADDRESSES.usdcSepolia,
    domain: 0,
    isL2: false,
  },
  {
    id: BASE_CHAIN.id,
    name: "Base Sepolia",
    shortName: "Base Sepolia",
    color: "#0052FF",
    icon: "https://cryptologos.cc/logos/base-base-logo.png",
    bridge: ADDRESSES.baseBridge,
    usdc: ADDRESSES.usdcBase,
    domain: 6,
    isL2: true,
  },
  {
    id: ARB_CHAIN.id,
    name: "Arbitrum Sepolia",
    shortName: "Arb Sepolia",
    color: "#28A0F0",
    icon: "https://cryptologos.cc/logos/arbitrum-arb-logo.png",
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
  return msg.slice(0, 90) || "Transaction failed";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChainBox({ 
  label, 
  chainId, 
  onSelect, 
  availableIds 
}: { 
  label: string; 
  chainId: number; 
  onSelect: (id: number) => void; 
  availableIds: number[] 
}) {
  const chain = CHAINS.find(c => c.id === chainId)!;
  
  return (
    <div 
      style={{ 
        flex: 1, 
        background: "rgba(255,255,255,0.03)", 
        borderRadius: "var(--radius-lg)", 
        padding: "1rem 1.25rem",
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        position: "relative",
        cursor: "pointer",
        border: "1px solid rgba(255,255,255,0.05)",
        transition: "all 0.2s ease"
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)")}
    >
      <div style={{ 
        width: 48, 
        height: 48, 
        borderRadius: "14px", 
        background: "linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        overflow: "hidden",
        flexShrink: 0
      }}>
         <img src={chain.icon} alt={chain.shortName} style={{ width: "28px", height: "28px", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em" }}>{label}</span>
        <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "white", letterSpacing: "-0.01em" }}>{chain.shortName}</span>
      </div>
      <select
        value={chainId}
        onChange={(e) => onSelect(Number(e.target.value))}
        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%" }}
      >
        {CHAINS.filter(c => availableIds.includes(c.id)).map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
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

  const [activeBurnTxHash, setActiveBurnTxHash] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("sb_active_burn_tx");
  });

  const fromChain = CHAINS.find((c) => c.id === fromId)!;
  const toChain = CHAINS.find((c) => c.id === toId)!;
  const isRightChain = currentChainId === fromId;

  useEffect(() => {
    const validTo = VALID_DESTINATIONS[fromId] || [];
    if (!validTo.includes(toId)) setToId(validTo[0] || ETH_CHAIN.id);
  }, [fromId, toId]);

  const { data: ethBal } = useReadContract({ address: ADDRESSES.usdcSepolia, abi: ERC20_ABI, functionName: "balanceOf", args: [address!], chainId: ETH_CHAIN.id, query: { enabled: !!address } });
  const { data: baseBal } = useReadContract({ address: ADDRESSES.usdcBase, abi: ERC20_ABI, functionName: "balanceOf", args: [address!], chainId: BASE_CHAIN.id, query: { enabled: !!address } });
  const { data: arbBal } = useReadContract({ address: ADDRESSES.usdcArb, abi: ERC20_ABI, functionName: "balanceOf", args: [address!], chainId: ARB_CHAIN.id, query: { enabled: !!address } });

  const balance = useMemo(() => {
    if (fromId === ETH_CHAIN.id) return ethBal;
    if (fromId === BASE_CHAIN.id) return baseBal;
    if (fromId === ARB_CHAIN.id) return arbBal;
    return 0n;
  }, [fromId, ethBal, baseBal, arbBal]);

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "var(--bg-surface)",
        borderRadius: "var(--radius-2xl)",
        padding: "2.5rem",
        width: "560px",
        boxShadow: "var(--shadow-lg)",
        position: "relative",
      }}
    >
      {/* Network Config */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
         <ChainBox label="From" chainId={fromId} onSelect={setFromId} availableIds={CHAINS.map(c => c.id)} />
         <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyCenter: "center", color: "var(--text-muted)", zIndex: 5, border: "4px solid var(--bg-surface)", margin: "0 -16px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
         </div>
         <ChainBox label="To" chainId={toId} onSelect={setToId} availableIds={VALID_DESTINATIONS[fromId] || []} />
      </div>

      {/* Amount Interface */}
      <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-lg)", padding: "2rem", marginTop: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <input
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{
              background: "none",
              border: "none",
              outline: "none",
              fontSize: "4rem",
              fontWeight: 600,
              color: "white",
              width: "100%",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "black", padding: "0.5rem 1rem", borderRadius: "100px", cursor: "pointer", border: "1px solid var(--border-default)" }}>
             <img src="https://cryptologos.cc/logos/usd-coin-usdc-logo.png" style={{ width: 24, height: 24 }} alt="USDC" />
             <span style={{ fontWeight: 800, color: "white", fontSize: "1rem" }}>USDC</span>
             <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ opacity: 0.5 }}>
               <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
             </svg>
          </div>
        </div>
        
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem", gap: "0.75rem", alignItems: "center" }}>
           <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
             {balance ? formatUsdc(balance as bigint) : "0.00"} USDC available
           </span>
           <button style={{ background: "rgba(255,255,255,0.05)", border: "none", color: "var(--text-secondary)", fontSize: "0.75rem", fontWeight: 700, padding: "0.25rem 0.6rem", borderRadius: "4px", cursor: "pointer" }}>MAX</button>
           <button style={{ background: "rgba(255,255,255,0.05)", border: "none", color: "var(--text-secondary)", display: "flex", padding: "0.25rem", borderRadius: "4px", cursor: "pointer" }}>
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
           </button>
        </div>
      </div>

      {/* Main Action */}
      <div style={{ marginTop: "1.5rem" }}>
        {!address ? (
          <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>Connect wallet to continue</p>
        ) : !isRightChain ? (
          <button
            onClick={() => switchChain?.({ chainId: fromId })}
            className="btn btn-primary"
            style={{ width: "100%", height: "64px", fontSize: "1.125rem" }}
          >
            Switch to {fromChain.shortName}
          </button>
        ) : (
          <button
            onClick={handleBridge}
            disabled={!amount || parseFloat(amount) <= 0}
            className="btn btn-primary"
            style={{ width: "100%", height: "64px", fontSize: "1.125rem" }}
          >
            Bridge to {toChain.shortName}
          </button>
        )}
      </div>

      <TransactionStatus state={txState} onReset={() => setTxState({ status: "idle" })} />
    </motion.div>
  );
}
