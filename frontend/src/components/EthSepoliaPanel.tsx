"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWatchContractEvent,
} from "wagmi";
import { maxUint256 } from "viem";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ETH_CHAIN } from "@/lib/chains";
import { ADDRESSES, ERC20_ABI, ETH_BRIDGE_ABI } from "@/lib/contracts";
import { encryptUsdcAmount, formatUsdc, shortAddr } from "@/lib/fhevm";
import { TransactionStatus, TxState } from "./TransactionStatus";

const ACCENT = "var(--accent-eth)";
const SHADOW = "var(--shadow-eth)";

// ── Shared primitives ────────────────────────────────────────────────────────

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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: "var(--bg-elevated)",
        border: `1px solid ${focused ? accent : "var(--border-subtle)"}`,
        borderRadius: "var(--radius-md)",
        boxShadow: focused ? `0 0 0 3px ${accent}22` : "none",
        transition: `border-color var(--transition-fast), box-shadow var(--transition-fast)`,
        overflow: "hidden",
      }}
    >
      <input
        type="number"
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min="0"
        step="any"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1,
          background: "none",
          border: "none",
          outline: "none",
          padding: "0.625rem 0.875rem",
          fontSize: "1.125rem",
          fontWeight: 300,
          color: "var(--text-primary)",
          textAlign: "right",
          fontFamily: "var(--font-mono), monospace",
        }}
        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span style={{ paddingRight: "0.875rem", fontSize: "0.75rem", fontWeight: 500, color: "var(--text-muted)", userSelect: "none" }}>
        USDC
      </span>
    </div>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  isLoading,
  children,
  accent,
}: {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { y: -1, filter: "brightness(1.1)" }}
      whileTap={disabled ? {} : { y: 0, scale: 0.99, filter: "brightness(0.95)" }}
      transition={{ duration: 0.12 }}
      style={{
        width: "100%",
        padding: "0.625rem 1.25rem",
        borderRadius: "var(--radius-md)",
        border: "none",
        background: disabled ? `${accent}60` : accent,
        color: "white",
        fontSize: "0.875rem",
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        transition: `background var(--transition-fast)`,
      }}
    >
      {isLoading && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%" }}
        />
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

export function EthSepoliaPanel({ entranceDelay = 0 }: { entranceDelay?: number }) {
  const { address, chainId } = useAccount();
  const isRightChain = chainId === ETH_CHAIN.id;

  const [amount, setAmount] = useState("");
  const [txState, setTxState] = useState<TxState>({ status: "idle" });
  const [bridgeStatus, setBridgeStatus] = useState<"idle" | "awaiting" | "done">("idle");
  const [isHovered, setIsHovered] = useState(false);

  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: ADDRESSES.usdcSepolia,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address!],
    chainId: ETH_CHAIN.id,
    query: { enabled: !!address },
  });

  const { writeContractAsync } = useWriteContract();

  useWatchContractEvent({
    address: ADDRESSES.ethBridge,
    abi: ETH_BRIDGE_ABI,
    eventName: "BridgeExecuted",
    chainId: ETH_CHAIN.id,
    onLogs(logs) {
      const mine = logs.find((l) => (l.args as { user?: string }).user?.toLowerCase() === address?.toLowerCase());
      if (mine) {
        setBridgeStatus("done");
        refetchBalance();
        setTxState({ status: "confirmed", hash: mine.transactionHash ?? "", chainId: ETH_CHAIN.id, label: "Bridge executed — arriving on Base" });
      }
    },
  });

  const handleBridge = useCallback(async () => {
    if (!address || !amount) return;
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return;
    try {
      setTxState({ status: "encrypting" });
      const { handle, inputProof } = await encryptUsdcAmount(num, ADDRESSES.ethBridge, address);
      setTxState({ status: "pending", description: "Approving USDC…" });
      const approveTx = await writeContractAsync({ address: ADDRESSES.usdcSepolia, abi: ERC20_ABI, functionName: "approve", args: [ADDRESSES.ethBridge, maxUint256], chainId: ETH_CHAIN.id });
      setTxState({ status: "mining", hash: approveTx, chainId: ETH_CHAIN.id });
      await new Promise((r) => setTimeout(r, 3000));
      setTxState({ status: "pending", description: "Submitting encrypted deposit…" });
      const depositTx = await writeContractAsync({ address: ADDRESSES.ethBridge, abi: ETH_BRIDGE_ABI, functionName: "depositConfidential", args: [handle, inputProof], chainId: ETH_CHAIN.id });
      setTxState({ status: "mining", hash: depositTx, chainId: ETH_CHAIN.id });
      setBridgeStatus("awaiting");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setTxState({ status: "error", message: msg.includes("User rejected") ? "Rejected in wallet" : msg.slice(0, 100) });
    }
  }, [address, amount, writeContractAsync]);

  const isBusy = txState.status === "encrypting" || txState.status === "pending" || txState.status === "mining";

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
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: "8px", height: "8px", borderRadius: "50%", background: ACCENT, flexShrink: 0 }}
        />
        <h2 style={{ fontSize: "1rem", fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          Ethereum Sepolia
        </h2>
        <span className="mono" style={{ marginLeft: "auto", fontSize: "0.6875rem", color: "var(--text-muted)" }}>
          #{ETH_CHAIN.id}
        </span>
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

          {/* Chain warning */}
          {!isRightChain && (
            <p style={{ fontSize: "0.8125rem", color: "var(--accent-warning)", marginBottom: "1rem" }}>
              Switch to Ethereum Sepolia to bridge.
            </p>
          )}

          {/* Bridge form */}
          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "1.25rem" }}>
            <SectionLabel>Amount to bridge</SectionLabel>
            <AmountInput value={amount} onChange={setAmount} accent={ACCENT} />
            <div style={{ marginTop: "0.75rem" }}>
              <PrimaryButton
                onClick={handleBridge}
                disabled={!isRightChain || !amount || isBusy}
                isLoading={isBusy}
                accent={ACCENT}
              >
                {isBusy ? "Processing…" : "Encrypt & Bridge →"}
              </PrimaryButton>
            </div>
            <TransactionStatus state={txState} onReset={() => { setTxState({ status: "idle" }); setBridgeStatus("idle"); }} />

            {bridgeStatus === "awaiting" && txState.status !== "error" && (
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}
              >
                Awaiting FHE decryption by KMS oracle…
              </motion.p>
            )}
            {bridgeStatus === "done" && (
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ fontSize: "0.75rem", color: "var(--accent-success)", marginTop: "0.5rem" }}
              >
                CCTP burn executed. Funds arriving on Base Sepolia.
              </motion.p>
            )}
          </div>

          {/* Privacy note */}
          <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "1rem", lineHeight: 1.6 }}>
            Amount is encrypted client-side before the transaction is signed. The contract receives a ciphertext handle, not a number.
          </p>
        </>
      )}
    </motion.div>
  );
}
