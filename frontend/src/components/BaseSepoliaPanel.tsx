"use client";

import { useState, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWatchContractEvent,
} from "wagmi";
import { BASE_CHAIN } from "@/lib/chains";
import { ADDRESSES, ERC20_ABI, BASE_BRIDGE_ABI } from "@/lib/contracts";
import { encryptUsdcAmount, formatUsdc, shortAddr } from "@/lib/fhevm";
import { TransactionStatus, TxState } from "./TransactionStatus";
import { BalanceReveal } from "./BalanceReveal";

const PURPLE = "#8B5CF6";

// ── Sub-components ────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[#6B7280] text-[10px] font-medium uppercase tracking-widest mb-1">
      {children}
    </span>
  );
}

function FieldRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span className="text-[#4B5563] text-xs">{label}</span>
      <span className={`text-sm text-white ${mono ? "font-[family-name:var(--font-mono)] text-xs" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}

function AmountInput({
  value,
  onChange,
  accent,
}: {
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  return (
    <div
      className="flex items-center rounded-lg overflow-hidden"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <input
        type="number"
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min="0"
        step="any"
        className="flex-1 bg-transparent px-3 py-2.5 text-white text-sm text-right
          placeholder:text-[#374151] outline-none
          [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        style={{ caretColor: accent }}
        onFocus={(e) =>
          (e.currentTarget.parentElement!.style.borderColor = `${accent}60`)
        }
        onBlur={(e) =>
          (e.currentTarget.parentElement!.style.borderColor = "rgba(255,255,255,0.1)")
        }
      />
      <span className="pr-3 text-[#4B5563] text-xs font-medium select-none">USDC</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BaseSepoliaPanel() {
  const { address, chainId } = useAccount();
  const isRightChain = chainId === BASE_CHAIN.id;

  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [stakeTx, setStakeTx] = useState<TxState>({ status: "idle" });
  const [unstakeTx, setUnstakeTx] = useState<TxState>({ status: "idle" });
  const [balanceTx, setBalanceTx] = useState<TxState>({ status: "idle" });
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [revealedAmount, setRevealedAmount] = useState<bigint | null>(null);

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

  // ── Events ────────────────────────────────────────────────────────────────
  useWatchContractEvent({
    address: ADDRESSES.baseBridge,
    abi: BASE_BRIDGE_ABI,
    eventName: "Staked",
    chainId: BASE_CHAIN.id,
    onLogs(logs) {
      const mine = logs.find(
        (l) => (l.args as { user?: string }).user?.toLowerCase() === address?.toLowerCase()
      );
      if (mine) {
        setStakeTx({ status: "confirmed", hash: mine.transactionHash ?? "", chainId: BASE_CHAIN.id, label: "Staked" });
        refetchBalance();
      }
    },
  });

  useWatchContractEvent({
    address: ADDRESSES.baseBridge,
    abi: BASE_BRIDGE_ABI,
    eventName: "UnstakeRequested",
    chainId: BASE_CHAIN.id,
    onLogs(logs) {
      const mine = logs.find(
        (l) => (l.args as { user?: string }).user?.toLowerCase() === address?.toLowerCase()
      );
      if (mine) {
        setUnstakeTx({ status: "confirmed", hash: mine.transactionHash ?? "", chainId: BASE_CHAIN.id, label: "Unstake requested — awaiting KMS callback" });
      }
    },
  });

  useWatchContractEvent({
    address: ADDRESSES.baseBridge,
    abi: BASE_BRIDGE_ABI,
    eventName: "UnstakeCompleted",
    chainId: BASE_CHAIN.id,
    onLogs(logs) {
      const mine = logs.find(
        (l) => (l.args as { user?: string }).user?.toLowerCase() === address?.toLowerCase()
      );
      if (mine) {
        setUnstakeTx({ status: "confirmed", hash: mine.transactionHash ?? "", chainId: BASE_CHAIN.id, label: "USDC returned" });
        refetchBalance();
      }
    },
  });

  useWatchContractEvent({
    address: ADDRESSES.baseBridge,
    abi: BASE_BRIDGE_ABI,
    eventName: "BalanceRevealed",
    chainId: BASE_CHAIN.id,
    onLogs(logs) {
      const mine = logs.find(
        (l) => (l.args as { user?: string }).user?.toLowerCase() === address?.toLowerCase()
      );
      if (mine) {
        const total = (mine.args as { total?: bigint }).total ?? 0n;
        setIsDecrypting(false);
        setRevealedAmount(total);
        setBalanceTx({ status: "idle" });
      }
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  const writeEncrypted = useCallback(
    async (
      amount: number,
      fn: "stake" | "unstake",
      setTx: (s: TxState) => void
    ) => {
      if (!address) return;
      try {
        setTx({ status: "encrypting" });
        const { handle, inputProof } = await encryptUsdcAmount(amount, ADDRESSES.baseBridge, address);
        setTx({ status: "pending", description: fn === "stake" ? "Staking…" : "Unstaking…" });
        const tx = await writeContractAsync({
          address: ADDRESSES.baseBridge,
          abi: BASE_BRIDGE_ABI,
          functionName: fn,
          args: [handle, inputProof],
          chainId: BASE_CHAIN.id,
        });
        setTx({ status: "mining", hash: tx, chainId: BASE_CHAIN.id });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed";
        setTx({ status: "error", message: msg.includes("User rejected") ? "Rejected in wallet" : msg.slice(0, 100) });
      }
    },
    [address, writeContractAsync]
  );

  const handleStake = useCallback(async () => {
    const num = parseFloat(stakeAmount);
    if (!num || num <= 0) return;
    await writeEncrypted(num, "stake", setStakeTx);
  }, [stakeAmount, writeEncrypted]);

  const handleUnstake = useCallback(async () => {
    const num = parseFloat(unstakeAmount);
    if (!num || num <= 0) return;
    await writeEncrypted(num, "unstake", setUnstakeTx);
  }, [unstakeAmount, writeEncrypted]);

  const handleDecryptBalance = useCallback(async () => {
    if (!address) return;
    try {
      setIsDecrypting(true);
      setRevealedAmount(null);
      setBalanceTx({ status: "pending", description: "Requesting decryption…" });
      const tx = await writeContractAsync({
        address: ADDRESSES.baseBridge,
        abi: BASE_BRIDGE_ABI,
        functionName: "decryptBalance",
        chainId: BASE_CHAIN.id,
      });
      setBalanceTx({ status: "mining", hash: tx, chainId: BASE_CHAIN.id });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setIsDecrypting(false);
      setBalanceTx({ status: "error", message: msg.includes("User rejected") ? "Rejected in wallet" : msg.slice(0, 100) });
    }
  }, [address, writeContractAsync]);

  const isBusy = (s: TxState) =>
    s.status === "encrypting" || s.status === "pending" || s.status === "mining";

  return (
    <div className="space-y-5">
      {/* ── Panel header ── */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: PURPLE, boxShadow: `0 0 6px ${PURPLE}60` }}
        />
        <h2 className="text-white text-xl font-medium tracking-tight">Base Sepolia</h2>
        <span className="ml-auto font-[family-name:var(--font-mono)] text-[10px] text-[#374151]">
          #{BASE_CHAIN.id}
        </span>
      </div>

      {/* ── Wallet info ── */}
      {address ? (
        <div>
          <FieldRow label="Wallet" value={shortAddr(address)} mono />
          <FieldRow
            label="USDC balance"
            value={usdcBalance ? `${formatUsdc(usdcBalance as bigint)} USDC` : "—"}
          />
        </div>
      ) : (
        <p className="text-[#374151] text-sm">Connect your wallet to continue.</p>
      )}

      {address && !isRightChain && (
        <p className="text-[#EAB308] text-xs">Switch to Base Sepolia to stake.</p>
      )}

      {/* ── Stake ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1.25rem" }} className="space-y-3">
        <Label>Stake</Label>
        <AmountInput value={stakeAmount} onChange={setStakeAmount} accent={PURPLE} />
        <button
          onClick={handleStake}
          disabled={!address || !isRightChain || !stakeAmount || isBusy(stakeTx) || !!hasPending}
          className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-all duration-150
            disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ background: isBusy(stakeTx) ? `${PURPLE}90` : PURPLE }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.filter = "brightness(1.12)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.filter = ""; }}
          onMouseDown={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.filter = "brightness(0.95)"; }}
          onMouseUp={(e) => { e.currentTarget.style.filter = ""; }}
        >
          {isBusy(stakeTx) && <span className="w-3.5 h-3.5 rounded-full border border-white/40 border-t-white animate-spin" />}
          {isBusy(stakeTx) ? "Processing…" : "Stake Confidentially"}
        </button>
        <TransactionStatus state={stakeTx} onReset={() => setStakeTx({ status: "idle" })} />
      </div>

      {/* ── Unstake ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1.25rem" }} className="space-y-3">
        <Label>Unstake</Label>
        <AmountInput value={unstakeAmount} onChange={setUnstakeAmount} accent={PURPLE} />
        <button
          onClick={handleUnstake}
          disabled={!address || !isRightChain || !unstakeAmount || isBusy(unstakeTx) || !!hasPending}
          className="w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-150
            disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ border: `1px solid ${PURPLE}`, color: PURPLE, background: "transparent" }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = `${PURPLE}18`; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          {isBusy(unstakeTx) && <span className="w-3.5 h-3.5 rounded-full border-[1.5px] border-current border-t-transparent animate-spin" />}
          {isBusy(unstakeTx) ? "Processing…" : "Unstake"}
        </button>
        <TransactionStatus state={unstakeTx} onReset={() => setUnstakeTx({ status: "idle" })} />
      </div>

      {/* ── Decrypt balance ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1.25rem" }} className="space-y-3">
        <div>
          <Label>Reveal balance</Label>
          <p className="text-[#4B5563] text-xs">
            Trigger on-chain KMS decryption to view your encrypted balance.
          </p>
        </div>

        <button
          onClick={handleDecryptBalance}
          disabled={!address || !isRightChain || isDecrypting || !!hasPending || isBusy(balanceTx)}
          className="w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-150
            disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ border: "1px solid rgba(255,255,255,0.12)", color: "#9CA3AF", background: "transparent" }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          {isDecrypting
            ? <><span className="w-3.5 h-3.5 rounded-full border border-[#9CA3AF]/40 border-t-[#9CA3AF] animate-spin" /> Decrypting…</>
            : "🔒 Decrypt My Balance"}
        </button>

        <TransactionStatus state={balanceTx} onReset={() => setBalanceTx({ status: "idle" })} />

        {/* ★ KEY DEMO MOMENT ★ */}
        <BalanceReveal
          revealedAmount={revealedAmount}
          isDecrypting={isDecrypting && revealedAmount === null}
          onReset={() => { setRevealedAmount(null); setIsDecrypting(false); }}
        />
      </div>
    </div>
  );
}
