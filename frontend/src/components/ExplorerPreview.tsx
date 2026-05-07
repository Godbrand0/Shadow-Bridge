"use client";

// ████ = U+2588 FULL BLOCK — represents encrypted/opaque data
const ENCRYPTED = "████████████";

type Row = {
  hash: string;
  chain: string;
  chainColor: string;
  fn: string;
  inputs: { name: string; encrypted: boolean }[];
};

const ROWS: Row[] = [
  {
    hash: "0x3f2a…c901",
    chain: "ETH",
    chainColor: "#F97316",
    fn: "depositConfidential()",
    inputs: [
      { name: "encryptedAmount", encrypted: true },
      { name: "inputProof",      encrypted: true },
    ],
  },
  {
    hash: "0x7e1b…44d2",
    chain: "Base",
    chainColor: "#8B5CF6",
    fn: "stake()",
    inputs: [
      { name: "encryptedAmount", encrypted: true },
      { name: "inputProof",      encrypted: true },
    ],
  },
  {
    hash: "0x2d9f…b803",
    chain: "Base",
    chainColor: "#8B5CF6",
    fn: "decryptBalance()",
    inputs: [],
  },
  {
    hash: "0x8c3a…2f71",
    chain: "Base",
    chainColor: "#8B5CF6",
    fn: "onBalanceDecryptCallback()",
    inputs: [
      { name: "abiEncodedResult", encrypted: true },
      { name: "decryptionProof",  encrypted: false },
    ],
  },
];

export function ExplorerPreview() {
  return (
    <section className="mt-8">
      {/* Header */}
      <div className="mb-4 flex items-baseline gap-3">
        <h3 className="text-[#9CA3AF] text-xs font-medium uppercase tracking-widest">
          What observers see on-chain
        </h3>
        <div className="flex-1 h-[1px]" style={{ background: "rgba(255,255,255,0.06)" }} />
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Column headers */}
        <div
          className="grid grid-cols-[1fr_auto_1fr_1fr] gap-4 px-4 py-2 text-[10px] font-medium uppercase tracking-widest text-[#4B5563]"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
        >
          <span>TX Hash</span>
          <span>Chain</span>
          <span>Function</span>
          <span>Amount</span>
        </div>

        {/* Rows */}
        {ROWS.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_auto_1fr_1fr] gap-4 px-4 py-3 items-start text-xs"
            style={{
              borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)",
              background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
            }}
          >
            {/* Hash */}
            <span className="font-[family-name:var(--font-mono)] text-[#4B5563] text-[11px]">
              {row.hash}
            </span>

            {/* Chain dot */}
            <div className="flex items-center gap-1 pt-px">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: row.chainColor }}
              />
              <span className="text-[#4B5563] text-[10px]">{row.chain}</span>
            </div>

            {/* Function name */}
            <span className="font-[family-name:var(--font-mono)] text-[#9CA3AF] text-[11px] break-all">
              {row.fn}
            </span>

            {/* Amount column */}
            <div className="space-y-0.5">
              {row.inputs.length === 0 ? (
                <span className="text-[#374151] text-[11px]">—</span>
              ) : (
                row.inputs.map((inp, j) => (
                  <div key={j} className="leading-none">
                    {inp.encrypted ? (
                      <span
                        className="font-[family-name:var(--font-mono)] text-[11px] select-none"
                        style={{ color: "#1F2937", letterSpacing: "-0.5px" }}
                        title={`${inp.name}: encrypted — not visible to observers`}
                      >
                        {ENCRYPTED}
                      </span>
                    ) : (
                      <span className="font-[family-name:var(--font-mono)] text-[#374151] text-[11px]">
                        {inp.name}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Caption */}
      <p className="mt-3 text-[#374151] text-xs text-center">
        ████ = encrypted ciphertext. No amount is ever visible to external observers.
      </p>
    </section>
  );
}
