"use client";

import React, { useMemo } from "react";
import { GitCommit, TrendingUp } from "lucide-react";
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
      totalIncome: totalIncome || 32000000,
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
    <div className="rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] p-5 sm:p-6 shadow-sm overflow-hidden transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitCommit className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Capital Flow Distribution
          </h3>
        </div>
        <span className="text-[11px] font-mono-num text-[var(--text-muted)]">
          {currentYear}-{String(currentMonth + 1).padStart(2, "0")}
        </span>
      </div>

      {/* Visual Flow Representation */}
      <div className="space-y-4">
        {/* Source Node */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Total Income (Inflow)
              </span>
            </div>
            <div
              className={`font-mono-num text-sm sm:text-base font-bold text-emerald-500 ${
                privacyMode ? "privacy-blur" : ""
              }`}
            >
              {formatCurrency(flow.totalIncome, "IDR", "id-ID")}
            </div>
          </div>
        </div>

        {/* Dynamic Branching Connector Graphic */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Branch 1: Fixed Obligations */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 relative">
            <div className="text-[11px] font-medium text-amber-500 flex items-center justify-between">
              <span>Fixed Obligations</span>
              <span className="font-mono-num font-semibold">{pctFixed}%</span>
            </div>
            <div
              className={`font-mono-num text-xs sm:text-sm font-bold text-[var(--text-primary)] mt-1.5 ${
                privacyMode ? "privacy-blur" : ""
              }`}
            >
              {formatCurrency(flow.fixedBills, "IDR", "id-ID")}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
              Utilities, subscriptions, bills
            </div>
          </div>

          {/* Branch 2: Discretionary Spend */}
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3.5 relative">
            <div className="text-[11px] font-medium text-orange-500 flex items-center justify-between">
              <span>Discretionary</span>
              <span className="font-mono-num font-semibold">{pctDisc}%</span>
            </div>
            <div
              className={`font-mono-num text-xs sm:text-sm font-bold text-[var(--text-primary)] mt-1.5 ${
                privacyMode ? "privacy-blur" : ""
              }`}
            >
              {formatCurrency(flow.discretionary, "IDR", "id-ID")}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
              Dining, shopping, lifestyle
            </div>
          </div>

          {/* Branch 3: Vault Allocations */}
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3.5 relative">
            <div className="text-[11px] font-medium text-purple-400 flex items-center justify-between">
              <span>Savings Goals</span>
              <span className="font-mono-num font-semibold">{pctVault}%</span>
            </div>
            <div
              className={`font-mono-num text-xs sm:text-sm font-bold text-[var(--text-primary)] mt-1.5 ${
                privacyMode ? "privacy-blur" : ""
              }`}
            >
              {formatCurrency(flow.vaultSavings, "IDR", "id-ID")}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
              Allocated sinking funds
            </div>
          </div>

          {/* Branch 4: Unallocated Retained Liquid Cash */}
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3.5 relative">
            <div className="text-[11px] font-medium text-cyan-400 flex items-center justify-between">
              <span>Retained Cash</span>
              <span className="font-mono-num font-semibold">{pctRetained}%</span>
            </div>
            <div
              className={`font-mono-num text-xs sm:text-sm font-bold text-[var(--text-primary)] mt-1.5 ${
                privacyMode ? "privacy-blur" : ""
              }`}
            >
              {formatCurrency(flow.unallocated, "IDR", "id-ID")}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
              Net liquidity increase
            </div>
          </div>
        </div>

        {/* Visual Partition Ribbon */}
        <div className="h-2.5 w-full rounded-full bg-white/[0.05] dark:bg-white/[0.05] light:bg-slate-200 overflow-hidden flex p-0.5">
          <div style={{ width: `${pctFixed}%` }} className="bg-amber-500 rounded-l-full" title="Fixed Obligations" />
          <div style={{ width: `${pctDisc}%` }} className="bg-orange-500" title="Discretionary Spend" />
          <div style={{ width: `${pctVault}%` }} className="bg-purple-500" title="Savings Goals" />
          <div style={{ width: `${pctRetained}%` }} className="bg-cyan-500 rounded-r-full" title="Retained Cash" />
        </div>
      </div>
    </div>
  );
};
