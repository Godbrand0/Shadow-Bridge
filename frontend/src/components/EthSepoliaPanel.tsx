"use client";

import { useState, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWatchContractEvent,
} from "wagmi";
import { maxUint256 } from "viem";
import { ETH_CHAIN } from "@/lib/chains";
import { ADDRESSES, ERC20_ABI, ETH_BRIDGE_ABI } from "@/lib/contracts";
import { encryptUsdcAmount, formatUsdc, shortAddr } from "@/lib/fhevm";
import { TransactionStatus, TxState } from "./TransactionStatus";

const ORANGE = "#F97316";

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

// ── Main component ────────────────────────────────────────────────────────────

export function EthSepoliaPanel() {
  const { address, chainId } = useAccount();
  const isRightChain = chainId === ETH_CHAIN.id;

  const [amount, setAmount] = useState("");
  const [txState, setTxState] = useState<TxState>({ status: "idle" });
  const [bridgeStatus, setBridgeStatus] = useState<"idle" | "awaiting" | "done">("idle");

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
      const mine = logs.find(
        (l) => (l.args as { user?: string }).user?.toLowerCase() === address?.toLowerCase()
      );
      if (mine) {
        setBridgeStatus("done");
        refetchBalance();
        setTxState({
          status: "confirmed",
          hash: mine.transactionHash ?? "",
          chainId: ETH_CHAIN.id,
          label: "Bridge executed — arriving on Base",
        });
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
      const approveTx = await writeContractAsync({
        address: ADDRESSES.usdcSepolia,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [ADDRESSES.ethBridge, maxUint256],
        chainId: ETH_CHAIN.id,
      });
      setTxState({ status: "mining", hash: approveTx, chainId: ETH_CHAIN.id });
      await new Promise((r) => setTimeout(r, 3000));

      setTxState({ status: "pending", description: "Submitting encrypted deposit…" });
      const depositTx = await writeContractAsync({
        address: ADDRESSES.ethBridge,
        abi: ETH_BRIDGE_ABI,
        functionName: "depositConfidential",
        args: [handle, inputProof],
        chainId: ETH_CHAIN.id,
      });
      setTxState({ status: "mining", hash: depositTx, chainId: ETH_CHAIN.id });
      setBridgeStatus("awaiting");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setTxState({
        status: "error",
        message: msg.includes("User rejected") ? "Rejected in wallet" : msg.slice(0, 100),
      });
    }
  }, [address, amount, writeContractAsync]);

  const isBusy =
    txState.status === "encrypting" ||
    txState.status === "pending" ||
    txState.status === "mining";

  return (
    <div className="space-y-5">
      {/* ── Panel header ── */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: ORANGE, boxShadow: `0 0 6px ${ORANGE}60` }}
        />
        <h2 className="text-white text-xl font-medium tracking-tight">Ethereum Sepolia</h2>
        <span
          className="ml-auto font-[family-name:var(--font-mono)] text-[10px]"
          style={{ color: "#374151" }}
        >
          #{ETH_CHAIN.id}
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

      {/* ── Chain warning ── */}
      {address && !isRightChain && (
        <p className="text-[#EAB308] text-xs">
          Switch to Ethereum Sepolia to bridge.
        </p>
      )}

      {/* ── Divider ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

      {/* ── Bridge form ── */}
      <div className="space-y-3">
        <div>
          <Label>Amount to bridge</Label>
          <div
            className="flex items-center rounded-lg overflow-hidden"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="any"
              className="flex-1 bg-transparent px-3 py-2.5 text-white text-sm text-right
                placeholder:text-[#374151] outline-none
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              style={{ caretColor: ORANGE }}
              onFocus={(e) =>
                (e.currentTarget.parentElement!.style.borderColor = `${ORANGE}60`)
              }
              onBlur={(e) =>
                (e.currentTarget.parentElement!.style.borderColor = "rgba(255,255,255,0.1)")
              }
            />
            <span className="pr-3 text-[#4B5563] text-xs font-medium select-none">USDC</span>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleBridge}
          disabled={!address || !isRightChain || !amount || isBusy}
          className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-all duration-150
            disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{
            background: isBusy ? `${ORANGE}90` : ORANGE,
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) e.currentTarget.style.filter = "brightness(1.12)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = "";
          }}
          onMouseDown={(e) => {
            if (!e.currentTarget.disabled) e.currentTarget.style.filter = "brightness(0.95)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.filter = "";
          }}
        >
          {isBusy && (
            <span className="w-3.5 h-3.5 rounded-full border border-white/40 border-t-white animate-spin" />
          )}
          {isBusy ? "Processing…" : "Encrypt & Bridge →"}
        </button>

        <TransactionStatus
          state={txState}
          onReset={() => { setTxState({ status: "idle" }); setBridgeStatus("idle"); }}
        />
      </div>

      {/* ── Post-bridge status ── */}
      {bridgeStatus === "awaiting" && txState.status !== "error" && (
        <p className="text-[#4B5563] text-xs">
          Awaiting FHE decryption by KMS oracle…
        </p>
      )}
      {bridgeStatus === "done" && (
        <p className="text-[#22C55E] text-xs">
          CCTP burn executed. Funds arriving on Base Sepolia.
        </p>
      )}

      {/* ── Privacy note ── */}
      <p className="text-[#374151] text-xs leading-relaxed pt-1">
        Your amount is encrypted client-side before the transaction is signed.
        The contract receives a ciphertext handle, not a number.
      </p>
    </div>
  );
}
