import { Header } from "@/components/Header";
import { EthSepoliaPanel } from "@/components/EthSepoliaPanel";
import { BaseSepoliaPanel } from "@/components/BaseSepoliaPanel";
import { ExplorerPreview } from "@/components/ExplorerPreview";

export default function Home() {
  return (
    <div className="min-h-dvh bg-[#0C0C10] flex flex-col">
      {/* Single top-of-page ambient gradient — very subtle */}
      <div
        className="fixed top-0 inset-x-0 h-[1px] pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)" }}
      />

      <Header />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Hero line */}
        <p className="text-center text-[#4B5563] text-sm mb-10 tracking-wide">
          Amounts are encrypted before they touch the chain.
          Nobody reads them until you decide.
        </p>

        {/* Two panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ETH Sepolia panel */}
          <div
            className="rounded-xl p-6"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.08)",
              // Single subtle ambient: warm orange tint at top-left
              boxShadow: "inset 0 0 80px rgba(249,115,22,0.025)",
            }}
          >
            <EthSepoliaPanel />
          </div>

          {/* Base Sepolia panel */}
          <div
            className="rounded-xl p-6"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.08)",
              // Single subtle ambient: cool purple tint
              boxShadow: "inset 0 0 80px rgba(139,92,246,0.025)",
            }}
          >
            <BaseSepoliaPanel />
          </div>
        </div>

        {/* Bridge direction label */}
        <div className="flex items-center justify-center gap-3 my-6 select-none">
          <span className="text-[#374151] text-xs font-mono">Ethereum Sepolia</span>
          <div className="flex items-center gap-1 text-[#374151]">
            <div className="w-8 h-[1px] bg-[rgba(255,255,255,0.08)]" />
            <span className="text-[10px] text-[#374151]">CCTP</span>
            <div className="w-8 h-[1px] bg-[rgba(255,255,255,0.08)]" />
            <span className="text-[#374151] text-[10px]">→</span>
          </div>
          <span className="text-[#374151] text-xs font-mono">Base Sepolia</span>
        </div>

        <ExplorerPreview />

        <footer className="mt-12 pb-8 text-center">
          <p className="text-[#374151] text-xs">
            Powered by{" "}
            <span className="text-[#6B7280]">Zama FHEVM</span>
            {" · "}
            <span className="text-[#6B7280]">Circle CCTP</span>
            {" · "}
            <span className="text-[#6B7280]">Base</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
