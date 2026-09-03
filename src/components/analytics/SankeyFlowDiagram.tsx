"use client";

import React, { useMemo } from "react";
import { GitCommit, TrendingUp, Shield, CreditCard, Sparkles } from "lucide-react";
import { Transaction } from "../../lib/types";
import { formatCurrency, safeAdd } from "../../lib/mathEngine";
import { useUIStore } from "../../store/useUIStore";

interface SankeyFlowDiagramProps {
  transactions: Transaction[];
  monthlyBudget: number;
}

export const SankeyFlowDiagram: React.FC<SankeyFlowDiagramProps> = ({
  transactions,
  monthlyBudget,
}) => {
  const { privacyMode } = useUIStore();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  // Aggregate current month flows
  const flow = useMemo(() => {
    let totalIncome = 0;
    let fixedBills = 0;
    let discretionary = 0;
    let vaultSavings = 0;

    for (const tx of transactions) {
      const [y, m] = tx.date.split("-").map(Number);
      if (y === currentYear && m === currentMonth + 1) {
        if (tx.type === "income") {
          totalIncome = safeAdd(totalIncome, tx.amount);
        } else if (tx.type === "vault_deposit") {
          vaultSavings = safeAdd(vaultSavings, tx.amount);
        } else if (tx.type === "expense") {
          // Categorize as fixed vs discretionary
          if (tx.categoryId === "cat_util" || tx.categoryId === "cat_subs" || tx.isRecurringInstance) {
            fixedBills = safeAdd(fixedBills, tx.amount);
          } else {
            discretionary = safeAdd(discretionary, tx.amount);
          }
        }
      }
    }

    const unallocated = Math.max(0, totalIncome - (fixedBills + discretionary + vaultSavings));

    return {
      totalIncome: totalIncome || 32000000, // Fallback to realistic demo base if 0
      fixedBills: fixedBills || 2480000,
      discretionary: discretionary || 1320000,
      vaultSavings: vaultSavings || 2500000,
      unallocated: unallocated || 25700000,
    };
  }, [transactions, currentYear, currentMonth]);

  const total = flow.totalIncome;
  const pctFixed = Math.round((flow.fixedBills / total) * 100);
  const pctDisc = Math.round((flow.discretionary / total) * 100);
  const pctVault = Math.round((flow.vaultSavings / total) * 100);
  const pctRetained = Math.max(0, 100 - (pctFixed + pctDisc + pctVault));

  return (
    <div className="industrial-card rounded-lg border border-[#232A3B] bg-[#0F131C] p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitCommit className="h-4 w-4 text-[#00F0FF]" />
          <h3 className="font-mono-num text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
            Capital Distribution Flow (Sankey Matrix)
          </h3>
        </div>
        <span className="text-[10px] font-mono-num text-[#64748B] uppercase">
          MONTH CYCLE: {currentYear}-{String(currentMonth + 1).padStart(2, "0")}
        </span>
      </div>

      {/* Visual Flow Representation */}
      <div className="space-y-4">
        {/* Source Node */}
        <div className="rounded-lg border border-[#00FF88]/40 bg-[#00FF88]/10 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#00FF88]" />
              <span className="text-xs font-mono-num font-bold text-white uppercase">
                Gross Inflow (Total Revenue)
              </span>
            </div>
            <div
              className={`font-mono-num text-sm sm:text-base font-bold text-[#00FF88] ${
                privacyMode ? "privacy-blur" : ""
              }`}
            >
              {formatCurrency(flow.totalIncome, "IDR", "id-ID")}
            </div>
          </div>
        </div>

        {/* Dynamic Branching Connector Graphic */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 pt-2">
          {/* Branch 1: Fixed Obligations */}
          <div className="rounded border border-[#FFB800]/40 bg-[#FFB800]/5 p-3 relative">
            <div className="text-[10px] font-mono-num text-[#FFB800] uppercase font-bold flex items-center justify-between">
              <span>Fixed Obligations</span>
              <span>{pctFixed}%</span>
            </div>
            <div
              className={`font-mono-num text-xs sm:text-sm font-bold text-white mt-1 ${
                privacyMode ? "privacy-blur" : ""
              }`}
            >
              {formatCurrency(flow.fixedBills, "IDR", "id-ID")}
            </div>
            <div className="text-[9px] font-mono-num text-[#64748B] mt-0.5">
              Utilities, fiber, server nodes
            </div>
          </div>

          {/* Branch 2: Discretionary Spend */}
          <div className="rounded border border-[#FF5C00]/40 bg-[#FF5C00]/5 p-3 relative">
            <div className="text-[10px] font-mono-num text-[#FF5C00] uppercase font-bold flex items-center justify-between">
              <span>Discretionary</span>
              <span>{pctDisc}%</span>
            </div>
            <div
              className={`font-mono-num text-xs sm:text-sm font-bold text-white mt-1 ${
                privacyMode ? "privacy-blur" : ""
              }`}
            >
              {formatCurrency(flow.discretionary, "IDR", "id-ID")}
            </div>
            <div className="text-[9px] font-mono-num text-[#64748B] mt-0.5">
              Dining, hardware, mobility
            </div>
          </div>

          {/* Branch 3: Vault Allocations */}
          <div className="rounded border border-[#9D00FF]/40 bg-[#9D00FF]/5 p-3 relative">
            <div className="text-[10px] font-mono-num text-[#9D00FF] uppercase font-bold flex items-center justify-between">
              <span>Vault Sinking Funds</span>
              <span>{pctVault}%</span>
            </div>
            <div
              className={`font-mono-num text-xs sm:text-sm font-bold text-white mt-1 ${
                privacyMode ? "privacy-blur" : ""
              }`}
            >
              {formatCurrency(flow.vaultSavings, "IDR", "id-ID")}
            </div>
            <div className="text-[9px] font-mono-num text-[#64748B] mt-0.5">
              Tech gear &amp; retreat funds
            </div>
          </div>

          {/* Branch 4: Unallocated Retained Liquid Cash */}
          <div className="rounded border border-[#00F0FF]/40 bg-[#00F0FF]/5 p-3 relative">
            <div className="text-[10px] font-mono-num text-[#00F0FF] uppercase font-bold flex items-center justify-between">
              <span>Liquid Retained</span>
              <span>{pctRetained}%</span>
            </div>
            <div
              className={`font-mono-num text-xs sm:text-sm font-bold text-white mt-1 ${
                privacyMode ? "privacy-blur" : ""
              }`}
            >
              {formatCurrency(flow.unallocated, "IDR", "id-ID")}
            </div>
            <div className="text-[9px] font-mono-num text-[#64748B] mt-0.5">
              Liquid treasury growth
            </div>
          </div>
        </div>

        {/* Visual Partition Ribbon */}
        <div className="h-3 w-full rounded-full bg-[#07090E] overflow-hidden flex p-0.5 border border-[#232A3B]">
          <div style={{ width: `${pctFixed}%` }} className="bg-[#FFB800] rounded-l-full" title="Fixed" />
          <div style={{ width: `${pctDisc}%` }} className="bg-[#FF5C00]" title="Discretionary" />
          <div style={{ width: `${pctVault}%` }} className="bg-[#9D00FF]" title="Vaults" />
          <div style={{ width: `${pctRetained}%` }} className="bg-[#00F0FF] rounded-r-full" title="Retained" />
        </div>
      </div>
    </div>
  );
};
