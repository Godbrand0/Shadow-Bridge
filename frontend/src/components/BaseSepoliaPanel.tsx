"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWatchContractEvent,
} from "wagmi";
import * as Tooltip from "@radix-ui/react-tooltip";
import { BASE_CHAIN } from "@/lib/chains";
import { ADDRESSES, ERC20_ABI, BASE_BRIDGE_ABI } from "@/lib/contracts";
import { encryptUsdcAmount, formatUsdc, shortAddr } from "@/lib/fhevm";
import { TransactionStatus, TxState } from "./TransactionStatus";
import { BalanceReveal } from "./BalanceReveal";

const ACCENT = "var(--accent-base)";
const ACCENT_MUTED = "var(--accent-base-muted)";
const SHADOW = "var(--shadow-base)";

// ── Shared primitives (duplicated for independence) ──────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "0.6875rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
      {children}
    </p>
  );
}

function FieldRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: "0.8125rem", color: "var(--text-primary)", fontWeight: 500 }} className={mono ? "mono" : ""}>
        {value}
      </span>
    </div>
  );
}

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <Tooltip.Provider delayDuration={100}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button onClick={handleCopy} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)", fontSize: "0.8125rem", fontWeight: 500, padding: 0 }} className="mono">
            {shortAddr(address)}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="tooltip-content" sideOffset={4}>
            {copied ? "Copied!" : "Click to copy"}
            <Tooltip.Arrow className="tooltip-arrow" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function AmountInput({ value, onChange, accent }: { value: string; onChange: (v: string) => void; accent: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      background: "var(--bg-elevated)",
      border: `1px solid ${focused ? accent : "var(--border-subtle)"}`,
      borderRadius: "var(--radius-md)",
      boxShadow: focused ? `0 0 0 3px ${accent}22` : "none",
      transition: `border-color var(--transition-fast), box-shadow var(--transition-fast)`,
      overflow: "hidden",
    }}>
      <input
        type="number"
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min="0"
        step="any"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ flex: 1, background: "none", border: "none", outline: "none", padding: "0.625rem 0.875rem", fontSize: "1.125rem", fontWeight: 300, color: "var(--text-primary)", textAlign: "right", fontFamily: "var(--font-mono), monospace" }}
        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span style={{ paddingRight: "0.875rem", fontSize: "0.75rem", fontWeight: 500, color: "var(--text-muted)", userSelect: "none" }}>
        USDC
      </span>
    </div>
  );
}

function PrimaryButton({ onClick, disabled, isLoading, children, accent }: { onClick: () => void; disabled?: boolean; isLoading?: boolean; children: React.ReactNode; accent: string }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { y: -1, filter: "brightness(1.1)" }}
      whileTap={disabled ? {} : { y: 0, scale: 0.99, filter: "brightness(0.95)" }}
      transition={{ duration: 0.12 }}
      style={{ width: "100%", padding: "0.625rem 1.25rem", borderRadius: "var(--radius-md)", border: "none", background: disabled ? `${accent}60` : accent, color: "white", fontSize: "0.875rem", fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
    >
      {isLoading && (
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%" }} />
      )}
      {children}
    </motion.button>
  );
}

function OutlineButton({ onClick, disabled, isLoading, children, accent }: { onClick: () => void; disabled?: boolean; isLoading?: boolean; children: React.ReactNode; accent: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { y: -1 }}
      whileTap={disabled ? {} : { y: 0, scale: 0.99 }}
      transition={{ duration: 0.12 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ width: "100%", padding: "0.625rem 1.25rem", borderRadius: "var(--radius-md)", border: `1px solid ${accent}`, background: hovered ? ACCENT_MUTED : "transparent", color: accent, fontSize: "0.875rem", fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", opacity: disabled ? 0.4 : 1, transition: `background var(--transition-fast)` }}
    >
      {isLoading && (
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          style={{ width: "14px", height: "14px", border: `2px solid ${accent}44`, borderTopColor: accent, borderRadius: "50%" }} />
      )}
      {children}
    </motion.button>
  );
}

function EmptyState({ accent }: { accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", padding: "1.5rem 0" }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", textAlign: "center" }}>Connect your wallet to get started</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BaseSepoliaPanel({ entranceDelay = 0 }: { entranceDelay?: number }) {
  const { address, chainId } = useAccount();
  const isRightChain = chainId === BASE_CHAIN.id;

  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [stakeTx, setStakeTx] = useState<TxState>({ status: "idle" });
  const [unstakeTx, setUnstakeTx] = useState<TxState>({ status: "idle" });
  const [balanceTx, setBalanceTx] = useState<TxState>({ status: "idle" });
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [revealedAmount, setRevealedAmount] = useState<bigint | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const { writeContractAsync } = useWriteContract();

  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: ADDRESSES.usdcBase,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address!],
    chainId: BASE_CHAIN.id,
    query: { enabled: !!address },
  });

  const { data: hasPending } = useReadContract({
    address: ADDRESSES.baseBridge,
    abi: BASE_BRIDGE_ABI,
    functionName: "hasPendingDecrypt",
    args: [address!],
    chainId: BASE_CHAIN.id,
    query: { enabled: !!address },
  });

  useWatchContractEvent({
    address: ADDRESSES.baseBridge,
    abi: BASE_BRIDGE_ABI,
    eventName: "Staked",
    chainId: BASE_CHAIN.id,
    onLogs(logs) {
      const mine = logs.find((l) => (l.args as { user?: string }).user?.toLowerCase() === address?.toLowerCase());
      if (mine) { setStakeTx({ status: "confirmed", hash: mine.transactionHash ?? "", chainId: BASE_CHAIN.id, label: "Staked" }); refetchBalance(); }
    },
  });

  useWatchContractEvent({
    address: ADDRESSES.baseBridge,
    abi: BASE_BRIDGE_ABI,
    eventName: "UnstakeRequested",
    chainId: BASE_CHAIN.id,
    onLogs(logs) {
      const mine = logs.find((l) => (l.args as { user?: string }).user?.toLowerCase() === address?.toLowerCase());
      if (mine) setUnstakeTx({ status: "confirmed", hash: mine.transactionHash ?? "", chainId: BASE_CHAIN.id, label: "Unstake requested — awaiting KMS callback" });
    },
  });

  useWatchContractEvent({
    address: ADDRESSES.baseBridge,
    abi: BASE_BRIDGE_ABI,
    eventName: "UnstakeCompleted",
    chainId: BASE_CHAIN.id,
    onLogs(logs) {
      const mine = logs.find((l) => (l.args as { user?: string }).user?.toLowerCase() === address?.toLowerCase());
      if (mine) { setUnstakeTx({ status: "confirmed", hash: mine.transactionHash ?? "", chainId: BASE_CHAIN.id, label: "USDC returned" }); refetchBalance(); }
    },
  });

  useWatchContractEvent({
    address: ADDRESSES.baseBridge,
    abi: BASE_BRIDGE_ABI,
    eventName: "BalanceRevealed",
    chainId: BASE_CHAIN.id,
    onLogs(logs) {
      const mine = logs.find((l) => (l.args as { user?: string }).user?.toLowerCase() === address?.toLowerCase());
      if (mine) {
        const total = (mine.args as { total?: bigint }).total ?? 0n;
        setIsDecrypting(false);
        setRevealedAmount(total);
        setBalanceTx({ status: "idle" });
      }
    },
  });

  const writeEncrypted = useCallback(async (amt: number, fn: "stake" | "unstake", setTx: (s: TxState) => void) => {
    if (!address) return;
    try {
      setTx({ status: "encrypting" });
      const { handle, inputProof } = await encryptUsdcAmount(amt, ADDRESSES.baseBridge, address);
      setTx({ status: "pending", description: fn === "stake" ? "Staking…" : "Unstaking…" });
      const tx = await writeContractAsync({ address: ADDRESSES.baseBridge, abi: BASE_BRIDGE_ABI, functionName: fn, args: [handle, inputProof], chainId: BASE_CHAIN.id });
      setTx({ status: "mining", hash: tx, chainId: BASE_CHAIN.id });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setTx({ status: "error", message: msg.includes("User rejected") ? "Rejected in wallet" : msg.slice(0, 100) });
    }
  }, [address, writeContractAsync]);

  const handleDecryptBalance = useCallback(async () => {
    if (!address) return;
    try {
      setIsDecrypting(true);
      setRevealedAmount(null);
      setBalanceTx({ status: "pending", description: "Requesting decryption…" });
      const tx = await writeContractAsync({ address: ADDRESSES.baseBridge, abi: BASE_BRIDGE_ABI, functionName: "decryptBalance", chainId: BASE_CHAIN.id });
      setBalanceTx({ status: "mining", hash: tx, chainId: BASE_CHAIN.id });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setIsDecrypting(false);
      setBalanceTx({ status: "error", message: msg.includes("User rejected") ? "Rejected in wallet" : msg.slice(0, 100) });
    }
  }, [address, writeContractAsync]);

  const isBusy = (s: TxState) => s.status === "encrypting" || s.status === "pending" || s.status === "mining";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: entranceDelay, ease: [0.4, 0, 0.2, 1] }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        padding: "1.5rem",
        transition: `border-color var(--transition-base), box-shadow var(--transition-base)`,
        ...(isHovered ? { borderColor: "var(--border-default)", boxShadow: SHADOW } : {}),
      }}
    >
      {/* Panel header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          style={{ width: "8px", height: "8px", borderRadius: "50%", background: ACCENT, flexShrink: 0 }}
        />
        <h2 style={{ fontSize: "1rem", fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Base Sepolia</h2>
        <span className="mono" style={{ marginLeft: "auto", fontSize: "0.6875rem", color: "var(--text-muted)" }}>#{BASE_CHAIN.id}</span>
      </div>

      {!address ? (
        <EmptyState accent={ACCENT} />
      ) : (
        <>
          {/* Wallet info */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>Wallet</span>
              <CopyAddress address={address} />
            </div>
            <FieldRow label="USDC balance" value={usdcBalance ? `${formatUsdc(usdcBalance as bigint)} USDC` : "—"} />
          </div>

          {!isRightChain && (
            <p style={{ fontSize: "0.8125rem", color: "var(--accent-warning)", marginBottom: "1rem" }}>
              Switch to Base Sepolia to stake.
            </p>
          )}

          {/* Stake */}
          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "1.25rem" }}>
            <SectionLabel>Stake</SectionLabel>
            <AmountInput value={stakeAmount} onChange={setStakeAmount} accent={ACCENT} />
            <div style={{ marginTop: "0.75rem" }}>
              <PrimaryButton onClick={() => { const n = parseFloat(stakeAmount); if (n > 0) writeEncrypted(n, "stake", setStakeTx); }} disabled={!isRightChain || !stakeAmount || isBusy(stakeTx) || !!hasPending} isLoading={isBusy(stakeTx)} accent={ACCENT}>
                {isBusy(stakeTx) ? "Processing…" : "Stake Confidentially"}
              </PrimaryButton>
            </div>
            <TransactionStatus state={stakeTx} onReset={() => setStakeTx({ status: "idle" })} />
          </div>

          {/* Unstake */}
          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "1.25rem", marginTop: "1.25rem" }}>
            <SectionLabel>Unstake</SectionLabel>
            <AmountInput value={unstakeAmount} onChange={setUnstakeAmount} accent={ACCENT} />
            <div style={{ marginTop: "0.75rem" }}>
              <OutlineButton onClick={() => { const n = parseFloat(unstakeAmount); if (n > 0) writeEncrypted(n, "unstake", setUnstakeTx); }} disabled={!isRightChain || !unstakeAmount || isBusy(unstakeTx) || !!hasPending} isLoading={isBusy(unstakeTx)} accent={ACCENT}>
                {isBusy(unstakeTx) ? "Processing…" : "Unstake"}
              </OutlineButton>
            </div>
            <TransactionStatus state={unstakeTx} onReset={() => setUnstakeTx({ status: "idle" })} />
          </div>

          {/* Decrypt balance */}
          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "1.25rem", marginTop: "1.25rem" }}>
            <SectionLabel>Reveal balance</SectionLabel>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "0.75rem", lineHeight: 1.5 }}>
              Trigger on-chain KMS decryption to view your encrypted balance.
            </p>
            <OutlineButton
              onClick={handleDecryptBalance}
              disabled={!isRightChain || isDecrypting || !!hasPending || isBusy(balanceTx)}
              isLoading={isDecrypting || isBusy(balanceTx)}
              accent="var(--text-secondary)"
            >
              {isDecrypting ? "Decrypting…" : "🔒 Decrypt My Balance"}
            </OutlineButton>
            <TransactionStatus state={balanceTx} onReset={() => setBalanceTx({ status: "idle" })} />

            {/* ★ KEY DEMO MOMENT ★ */}
            <BalanceReveal
              revealedAmount={revealedAmount}
              isDecrypting={isDecrypting && revealedAmount === null}
              onReset={() => { setRevealedAmount(null); setIsDecrypting(false); }}
            />
          </div>
        </>
      )}
    </motion.div>
  );
}
