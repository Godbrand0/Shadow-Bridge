"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { UnifiedBridgePanel } from "@/components/UnifiedBridgePanel";
import { TransactionHistory } from "@/components/TransactionHistory";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"bridge" | "history">("bridge");

  return (
    <div style={{ minHeight: "100dvh", position: "relative", overflow: "hidden" }}>
      <Header />

      <main 
        style={{ 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          justifyContent: "center", 
          padding: "2rem",
          paddingTop: "4rem",
          zIndex: 1,
          position: "relative"
        }}
      >
        {/* Sub-header tabs/settings like in the image */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "2rem", width: activeTab === "bridge" ? "560px" : "1000px", maxWidth: "100%", justifyContent: "space-between", transition: "width 0.3s ease" }}>
           <div 
             onClick={() => setActiveTab("bridge")}
             style={{ background: activeTab === "bridge" ? "white" : "rgba(255,255,255,0.05)", padding: "0.25rem 0.75rem", borderRadius: "100px", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", transition: "all 0.2s" }}
           >
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: activeTab === "bridge" ? "black" : "white" }}>
                {activeTab === "bridge" ? "Bridge" : "Testnet"}
              </span>
           </div>
           
           <div style={{ display: "flex", gap: "1rem" }}>
              <button 
                onClick={() => setActiveTab("history")}
                style={{ background: "none", border: "none", color: activeTab === "history" ? "white" : "var(--text-muted)", cursor: "pointer", transition: "color 0.2s" }}
              >
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </button>
              <button style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </button>
           </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "bridge" ? (
            <motion.div
              key="bridge"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <UnifiedBridgePanel />
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              style={{ width: "100%", maxWidth: "1000px" }}
            >
              <TransactionHistory />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Informative Footer metadata (adapted to Superbridge style) */}
        {activeTab === "bridge" && (
          <div style={{ marginTop: "4rem", display: "flex", gap: "3rem" }}>
            <div style={{ textAlign: "center" }}>
                <span className="label-caps" style={{ display: "block", marginBottom: "0.5rem" }}>Security</span>
                <span style={{ fontSize: "0.875rem", color: "white", fontWeight: 600 }}>CCTP V2 Native</span>
            </div>
            <div style={{ textAlign: "center" }}>
                <span className="label-caps" style={{ display: "block", marginBottom: "0.5rem" }}>Privacy</span>
                <span style={{ fontSize: "0.875rem", color: "white", fontWeight: 600 }}>Zama FHEVM</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
