"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWatchContractEvent,
  useSwitchChain,
} from "wagmi";
import { maxUint256 } from "viem";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ETH_CHAIN, BASE_CHAIN, ARB_CHAIN } from "@/lib/chains";
import { ADDRESSES, ERC20_ABI, ETH_BRIDGE_ABI, DEST_BRIDGE_ABI } from "@/lib/contracts";
import { encryptUsdcAmount, formatUsdc, shortAddr } from "@/lib/fhevm";
import { TransactionStatus, TxState } from "./TransactionStatus";
import { BalanceReveal } from "./BalanceReveal";

// ── Types & Data ────────────────────────────────────────────────────────────

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
    shortName: "ETH",
    color: "var(--accent-eth)",
    icon: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=032",
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
    icon: "https://cryptologos.cc/logos/base-base-logo.svg?v=032",
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
    icon: "https://cryptologos.cc/logos/arbitrum-arb-logo.svg?v=032",
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

// ── UI Components ────────────────────────────────────────────────────────────

function ChainDropdown({ label, selectedId, onSelect, availableIds }: { label: string; selectedId: number; onSelect: (id: number) => void; availableIds: number[] }) {
  const selected = CHAINS.find((c) => c.id === selectedId)!;
  return (
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "0.5rem" }}>{label}</p>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem 1rem", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", transition: "all 0.2s" }} className="hover:border-border-default">
          <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: selected.color, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: `0 0 12px ${selected.color}33` }}>
             <img src={selected.icon} alt={selected.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0) invert(1) grayscale(0.2)" }} />
          </div>
          <span style={{ fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "-0.01em" }}>{selected.shortName}</span>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ marginLeft: "auto", opacity: 0.4 }}>
            <path d="M1 1.5L5 4.5L9 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <select value={selectedId} onChange={(e) => onSelect(Number(e.target.value))} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%" }}>
            {CHAINS.filter((c) => availableIds.includes(c.id)).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function UnifiedBridgePanel() {
  const { address, chainId: currentChainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [fromId, setFromId] = useState(ETH_CHAIN.id);
  const [toId, setToId] = useState(BASE_CHAIN.id);
  const [amount, setAmount] = useState("");
  const [txState, setTxState] = useState<TxState>({ status: "idle" });
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [revealedAmount, setRevealedAmount] = useState<bigint | null>(null);

  const fromChain = CHAINS.find((c) => c.id === fromId)!;
  const toChain = CHAINS.find((c) => c.id === toId)!;
  const isRightChain = currentChainId === fromId;

  useEffect(() => {
    const validTo = VALID_DESTINATIONS[fromId] || [];
    if (!validTo.includes(toId)) setToId(validTo[0] || ETH_CHAIN.id);
  }, [fromId, toId]);

  // Hooks for data
  const { data: ethBal, refetch: refEth } = useReadContract({ address: ADDRESSES.usdcSepolia, abi: ERC20_ABI, functionName: "balanceOf", args: [address!], chainId: ETH_CHAIN.id, query: { enabled: !!address } });
  const { data: baseBal, refetch: refBase } = useReadContract({ address: ADDRESSES.usdcBase, abi: ERC20_ABI, functionName: "balanceOf", args: [address!], chainId: BASE_CHAIN.id, query: { enabled: !!address } });
  const { data: arbBal, refetch: refArb } = useReadContract({ address: ADDRESSES.usdcArb, abi: ERC20_ABI, functionName: "balanceOf", args: [address!], chainId: ARB_CHAIN.id, query: { enabled: !!address } });

  const { data: pETH } = useReadContract({ address: ADDRESSES.ethBridge, abi: ETH_BRIDGE_ABI, functionName: "hasPendingBridge", args: [address!], chainId: ETH_CHAIN.id, query: { enabled: !!address } });
  const { data: pBD } = useReadContract({ address: ADDRESSES.baseBridge, abi: DEST_BRIDGE_ABI, functionName: "hasPendingDecrypt", args: [address!], chainId: BASE_CHAIN.id, query: { enabled: !!address } });
  const { data: pBB } = useReadContract({ address: ADDRESSES.baseBridge, abi: DEST_BRIDGE_ABI, functionName: "hasPendingBridge", args: [address!], chainId: BASE_CHAIN.id, query: { enabled: !!address } });
  const { data: pAD } = useReadContract({ address: ADDRESSES.arbBridge, abi: DEST_BRIDGE_ABI, functionName: "hasPendingDecrypt", args: [address!], chainId: ARB_CHAIN.id, query: { enabled: !!address } });
  const { data: pAB } = useReadContract({ address: ADDRESSES.arbBridge, abi: DEST_BRIDGE_ABI, functionName: "hasPendingBridge", args: [address!], chainId: ARB_CHAIN.id, query: { enabled: !!address } });

  const isPending = useMemo(() => {
    if (fromId === ETH_CHAIN.id) return !!pETH;
    if (fromId === BASE_CHAIN.id) return !!pBD || !!pBB;
    if (fromId === ARB_CHAIN.id) return !!pAD || !!pAB;
    return false;
  }, [fromId, pETH, pBD, pBB, pAD, pAB]);

  const balance = useMemo(() => {
    if (fromId === ETH_CHAIN.id) return ethBal;
    if (fromId === BASE_CHAIN.id) return baseBal;
    if (fromId === ARB_CHAIN.id) return arbBal;
    return 0n;
  }, [fromId, ethBal, baseBal, arbBal]);

  const onDone = useCallback((label: string) => {
    setTxState({ status: "confirmed", hash: "0x...", chainId: fromId, label });
    refEth(); refBase(); refArb();
  }, [fromId, refEth, refBase, refArb]);

  useWatchContractEvent({ address: fromChain.bridge, abi: fromChain.isL2 ? DEST_BRIDGE_ABI : ETH_BRIDGE_ABI, eventName: "BridgeExecuted", chainId: fromId, onLogs() { onDone("Transfer finalized — CCTP burn complete"); } });
  useWatchContractEvent({ address: fromChain.bridge, abi: DEST_BRIDGE_ABI, eventName: "Staked", chainId: fromId, onLogs() { onDone("USDC Staked Confidentially"); } });
  useWatchContractEvent({ address: fromChain.bridge, abi: DEST_BRIDGE_ABI, eventName: "BalanceRevealed", chainId: fromId, onLogs(logs) {
    if (!fromChain.isL2) return;
    const mine = logs.find((l) => (l.args as any).user?.toLowerCase() === address?.toLowerCase());
    if (mine) { setIsDecrypting(false); setRevealedAmount((mine.args as any).total ?? 0n); setTxState({ status: "idle" }); }
  }});

  const handleAction = async (type: "bridge" | "stake") => {
    if (!address || !amount || !isRightChain) return;
    const num = parseFloat(amount);
    try {
      setTxState({ status: "encrypting" });
      const { handle, inputProof } = await encryptUsdcAmount(num, fromChain.bridge, address);
      if (type === "bridge") {
        if (fromId === ETH_CHAIN.id) {
          setTxState({ status: "pending", description: "Approving USDC…" });
          const app = await writeContractAsync({ address: fromChain.usdc, abi: ERC20_ABI, functionName: "approve", args: [fromChain.bridge, maxUint256], chainId: fromId });
          setTxState({ status: "mining", hash: app, chainId: fromId });
          await new Promise(r => setTimeout(r, 2000));
          setTxState({ status: "pending", description: "Initiating Bridge…" });
          const tx = await writeContractAsync({ address: fromChain.bridge, abi: ETH_BRIDGE_ABI, functionName: "depositConfidential", args: [handle, inputProof, toChain.domain], chainId: fromId });
          setTxState({ status: "mining", hash: tx, chainId: fromId });
        } else {
          setTxState({ status: "pending", description: "Initiating L2 Bridge…" });
          const recp = "0x" + address.slice(2).padStart(64, "0");
          const tx = await writeContractAsync({ address: fromChain.bridge, abi: DEST_BRIDGE_ABI, functionName: "bridgeOut", args: [handle, inputProof, toChain.domain, recp as `0x${string}`], chainId: fromId });
          setTxState({ status: "mining", hash: tx, chainId: fromId });
        }
      } else {
        setTxState({ status: "pending", description: "Staking USDC…" });
        const tx = await writeContractAsync({ address: fromChain.bridge, abi: DEST_BRIDGE_ABI, functionName: "stake", args: [handle, inputProof], chainId: fromId });
        setTxState({ status: "mining", hash: tx, chainId: fromId });
      }
    } catch (err: any) { setTxState({ status: "error", message: err.message?.slice(0, 80) || "Failed" }); }
  };

  const handleReveal = async () => {
    if (!address || !isRightChain || !fromChain.isL2) return;
    try {
      setIsDecrypting(true); setRevealedAmount(null); setTxState({ status: "pending", description: "Decrypting staked balance…" });
      const tx = await writeContractAsync({ address: fromChain.bridge, abi: DEST_BRIDGE_ABI, functionName: "decryptBalance", chainId: fromId });
      setTxState({ status: "mining", hash: tx, chainId: fromId });
    } catch (err: any) { setIsDecrypting(false); setTxState({ status: "error", message: err.message?.slice(0, 80) || "Failed" }); }
  };

  const canAction = address && isRightChain && amount && !isPending && txState.status === "idle";

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xl)", padding: "2rem", boxShadow: "0 32px 80px -16px rgba(0,0,0,0.2)", maxWidth: "500px", margin: "0 auto", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem" }}>
         <ChainDropdown label="From" selectedId={fromId} onSelect={setFromId} availableIds={CHAINS.map(c => c.id)} />
         <div style={{ marginTop: "1.25rem", color: "var(--text-muted)", opacity: 0.5 }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
         <ChainDropdown label="To" selectedId={toId} onSelect={setToId} availableIds={VALID_DESTINATIONS[fromId] || []} />
      </div>

      <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", padding: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Amount</span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Balance: <span className="mono">{balance ? formatUsdc(balance as bigint) : "0.00"}</span></span>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: "1.5rem", fontWeight: 500, color: "var(--text-muted)", marginRight: "0.75rem" }}>USDC</span>
          <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: "2.25rem", fontWeight: 300, textAlign: "right", color: "var(--text-primary)" }} className="mono" />
        </div>
      </div>

      <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {!address ? (
           <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>Connect wallet to bridge assets</p>
        ) : !isRightChain ? (
           <button onClick={() => switchChain?.({ chainId: fromId })} style={{ width: "100%", padding: "1.125rem", borderRadius: "var(--radius-lg)", border: `1px solid ${fromChain.color}44`, background: `${fromChain.color}11`, color: fromChain.color, fontWeight: 600, cursor: "pointer", fontSize: "1rem" }}>Switch to {fromChain.name}</button>
        ) : (
           <>
             <button onClick={() => handleAction("bridge")} disabled={!canAction} style={{ width: "100%", padding: "1.125rem", borderRadius: "var(--radius-lg)", border: "none", background: canAction ? "var(--text-primary)" : "var(--border-default)", color: "var(--bg-surface)", fontSize: "1.125rem", fontWeight: 700, cursor: canAction ? "pointer" : "not-allowed", transition: "all 0.2s" }} className="hover:brightness-110 active:scale-[0.98]">
               {isPending ? "Waiting for Decryption..." : `Bridge to ${toChain.shortName}`}
             </button>
             {fromChain.isL2 && (
               <div style={{ display: "flex", gap: "0.75rem" }}>
                 <button onClick={() => handleAction("stake")} disabled={!canAction} style={{ flex: 1, padding: "0.875rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontWeight: 600, cursor: canAction ? "pointer" : "not-allowed", fontSize: "0.875rem" }}>Stake</button>
                 <button onClick={handleReveal} disabled={!isRightChain || isDecrypting || isPending} style={{ flex: 1, padding: "0.875rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--bg-elevated)", color: fromChain.color, fontWeight: 600, cursor: "pointer", fontSize: "0.875rem" }}>{isDecrypting ? "Decrypting..." : "Reveal Staked"}</button>
               </div>
             )}
           </>
        )}
      </div>

      <TransactionStatus state={txState} onReset={() => setTxState({ status: "idle" })} />
      <BalanceReveal revealedAmount={revealedAmount} isDecrypting={isDecrypting} onReset={() => setRevealedAmount(null)} />

      <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border-subtle)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
         <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
            <p style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Privacy Protocol</p>
            Zero-knowledge proofs and FHE handles ensure your transaction amounts are never public.
         </div>
         <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
            <p style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Liquidity</p>
            Powered by Circle CCTP V2 for slippage-free asset movement across chains.
         </div>
      </div>
    </motion.div>
  );
}
