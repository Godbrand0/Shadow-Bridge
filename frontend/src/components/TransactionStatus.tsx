"use client";

import { getExplorerTxUrl } from "@/lib/chains";

export type TxState =
  | { status: "idle" }
  | { status: "encrypting" }
  | { status: "pending"; description: string }
  | { status: "mining"; hash: string; chainId: number }
  | { status: "confirmed"; hash: string; chainId: number; label: string }
  | { status: "error"; message: string };

interface Props {
  state: TxState;
  onReset?: () => void;
}

const DOT_COLORS: Record<string, string> = {
  encrypting: "#EAB308",
  pending:    "#EAB308",
  mining:     "#3B82F6",
  confirmed:  "#22C55E",
  error:      "#EF4444",
};

const Spinner = () => (
  <span
    className="inline-block w-3 h-3 rounded-full border border-current border-t-transparent animate-spin flex-shrink-0"
    style={{ borderColor: "currentColor", borderTopColor: "transparent" }}
  />
);

export function TransactionStatus({ state, onReset }: Props) {
  if (state.status === "idle") return null;

  const dotColor = DOT_COLORS[state.status] ?? "#6B7280";

  return (
    <div className="status-appear flex items-start gap-2 mt-2 text-xs text-[#9CA3AF]">
      {/* Status indicator */}
      {state.status === "mining" || state.status === "encrypting" || state.status === "pending" ? (
        <span className="mt-0.5 text-[#9CA3AF]"><Spinner /></span>
      ) : (
        <span
          className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: dotColor }}
        />
      )}

      <div className="flex-1 min-w-0 space-y-0.5">
        {state.status === "encrypting" && (
          <span className="text-[#EAB308]">Encrypting with FHEVM…</span>
        )}
        {state.status === "pending" && (
          <span>{state.description}</span>
        )}
        {state.status === "mining" && (
          <>
            <span className="block text-[#9CA3AF]">Waiting for confirmation…</span>
            <HashLink hash={state.hash} chainId={state.chainId} />
          </>
        )}
        {state.status === "confirmed" && (
          <>
            <span className="block text-[#22C55E]">{state.label}</span>
            <HashLink hash={state.hash} chainId={state.chainId} />
            {onReset && (
              <button
                onClick={onReset}
                className="block text-[#4B5563] hover:text-[#9CA3AF] mt-1 transition-colors"
              >
                Dismiss
              </button>
            )}
          </>
        )}
        {state.status === "error" && (
          <>
            <span className="block text-[#EF4444]">{state.message}</span>
            {onReset && (
              <button
                onClick={onReset}
                className="block text-[#4B5563] hover:text-[#9CA3AF] mt-0.5 transition-colors"
              >
                Try again
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function HashLink({ hash, chainId }: { hash: string; chainId: number }) {
  const url = getExplorerTxUrl(chainId, hash);
  const short = `${hash.slice(0, 8)}…${hash.slice(-6)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-[family-name:var(--font-mono)] text-[#4B5563] hover:text-[#9CA3AF] transition-colors flex items-center gap-1"
    >
      {short}
      <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 12 12">
        <path d="M2 10L10 2M10 2H5M10 2v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}
