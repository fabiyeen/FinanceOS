"use client";

import React from "react";
import {
  Flame,
  Hourglass,
  Percent,
  Plus,
  ArrowRightLeft,
  FileSpreadsheet,
  Zap,
  Shield,
} from "lucide-react";
import { useUIStore } from "../store/useUIStore";
import { db } from "../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";
import {
  calculateDebtToAssetRatio,
  calculateNetWorth,
  calculateRunway,
  computeMonthlyMetrics,
  formatCurrency,
} from "../lib/mathEngine";
import { playSound, triggerHaptic } from "../lib/audioHaptics";

// Views & Components
import { TransactionFeed } from "../components/ledger/TransactionFeed";
import { AccountDrawer } from "../components/ledger/AccountDrawer";
import { VaultCard } from "../components/ledger/VaultCard";
import { SpendVelocityGauge } from "../components/analytics/SpendVelocityGauge";
import { SankeyFlowDiagram } from "../components/analytics/SankeyFlowDiagram";
import { HeatmapCalendar } from "../components/analytics/HeatmapCalendar";
import { CashflowHorizonChart } from "../components/analytics/CashflowHorizonChart";
import { ExpenseTreemap } from "../components/analytics/ExpenseTreemap";
import { ToolsView } from "../components/tools/ToolsView";

export default function DashboardPage() {
  const {
    activeTab,
    privacyMode,
    soundEnabled,
    openQuickTx,
    setCmdBarOpen,
    setCsvImportOpen,
    openVaultModal,
  } = useUIStore();

  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const vaults = useLiveQuery(() => db.vaults.toArray()) ?? [];
  const debts = useLiveQuery(() => db.debts.toArray()) ?? [];
  const recurring = useLiveQuery(() => db.recurring.toArray()) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray()) ?? [];
  const transactions = useLiveQuery(() => db.transactions.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.get("main"));

  const currency = settings?.currency || "IDR";
  const locale = settings?.locale || "id-ID";
  const monthlyBudget = settings?.monthlyBudget || 18000000;

  // Math Engine Calculations
  const netWorth = calculateNetWorth(accounts, vaults, debts);
  const metrics = computeMonthlyMetrics(transactions, new Date(), monthlyBudget);
  const runway = calculateRunway(accounts, transactions, new Date());
  const debtRatio = calculateDebtToAssetRatio(accounts, debts, netWorth);

  return (
    <div className="space-y-6">
      {/* Overview Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Top High-Density Metric Telemetry Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {/* 1. Monthly Burn & Budget */}
            <div className="industrial-card rounded-lg p-3 sm:p-4 border border-[#232A3B] bg-[#0F131C]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] flex items-center gap-1">
                  <Flame className="h-3 w-3 text-[#FF5C00]" />
                  Burn Rate
                </span>
                <span className="text-[9px] font-mono-num text-[#94A3B8]">
                  {metrics.spendVelocityRatio.toFixed(2)}x PACING
                </span>
              </div>
              <div
                className={`font-mono-num text-base sm:text-xl font-bold text-white mt-1.5 ${
                  privacyMode ? "privacy-blur" : ""
                }`}
              >
                {formatCurrency(metrics.spentThisMonth, currency, locale)}
              </div>
              <div className="text-[10px] font-mono-num text-[#64748B] mt-1">
                Budget: {formatCurrency(monthlyBudget, currency, locale)}
              </div>
            </div>

            {/* 2. Runway Calculator */}
            <div className="industrial-card rounded-lg p-3 sm:p-4 border border-[#232A3B] bg-[#0F131C]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] flex items-center gap-1">
                  <Hourglass className="h-3 w-3 text-[#00FF88]" />
                  Runway
                </span>
                <span className="rounded bg-[#00FF88]/15 px-1 py-0.2 text-[9px] font-mono-num font-bold text-[#00FF88]">
                  [LIQUID]
                </span>
              </div>
              <div className="font-mono-num text-base sm:text-xl font-bold text-[#00FF88] mt-1.5">
                {runway.runwayMonths} MONTHS
              </div>
              <div
                className={`text-[10px] font-mono-num text-[#64748B] mt-1 ${
                  privacyMode ? "privacy-blur" : ""
                }`}
              >
                Reserves: {formatCurrency(runway.liquidReserves, currency, locale)}
              </div>
            </div>

            {/* 3. Savings Rate */}
            <div className="industrial-card rounded-lg p-3 sm:p-4 border border-[#232A3B] bg-[#0F131C]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] flex items-center gap-1">
                  <Percent className="h-3 w-3 text-[#00F0FF]" />
                  Savings Rate
                </span>
                <span className="text-[9px] font-mono-num text-[#00F0FF]">
                  [EFFICIENCY]
                </span>
              </div>
              <div className="font-mono-num text-base sm:text-xl font-bold text-[#00F0FF] mt-1.5">
                {metrics.savingsRate.toFixed(1)}%
              </div>
              <div
                className={`text-[10px] font-mono-num text-[#64748B] mt-1 ${
                  privacyMode ? "privacy-blur" : ""
                }`}
              >
                Inflow: {formatCurrency(metrics.incomeThisMonth, currency, locale)}
              </div>
            </div>

            {/* 4. Debt-to-Asset Ratio */}
            <div className="industrial-card rounded-lg p-3 sm:p-4 border border-[#232A3B] bg-[#0F131C]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] flex items-center gap-1">
                  <Shield className="h-3 w-3 text-[#FFB800]" />
                  Debt-to-Asset
                </span>
                <span className="text-[9px] font-mono-num text-[#94A3B8]">
                  [GEARING]
                </span>
              </div>
              <div className="font-mono-num text-base sm:text-xl font-bold text-white mt-1.5">
                {debtRatio.toFixed(1)}%
              </div>
              <div className="text-[10px] font-mono-num text-[#00FF88] mt-1">
                {debtRatio < 30 ? "PRUDENT (LEAN LEVERAGE)" : "ELEVATED RATIO"}
              </div>
            </div>
          </div>

          {/* Quick Action Matrix Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              onClick={() => {
                playSound("click", soundEnabled);
                triggerHaptic(15);
                setCmdBarOpen(true);
              }}
              className="flex items-center justify-between p-3 rounded-lg border border-[#232A3B] bg-[#0F131C] hover:border-[#00F0FF]/50 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded bg-[#161B26] text-[#00F0FF] border border-[#232A3B]">
                  <Zap className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white font-mono-num uppercase">
                    Command Bar
                  </div>
                  <div className="text-[10px] font-mono-num text-[#64748B]">
                    Natural language fast dispatch
                  </div>
                </div>
              </div>
              <span className="font-mono-num text-[10px] text-[#64748B] group-hover:text-[#00F0FF]">
                CMD+K
              </span>
            </button>

            <button
              onClick={() => {
                playSound("click", soundEnabled);
                triggerHaptic(15);
                openQuickTx({ type: "transfer" });
              }}
              className="flex items-center justify-between p-3 rounded-lg border border-[#232A3B] bg-[#0F131C] hover:border-[#00FF88]/50 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded bg-[#161B26] text-[#00FF88] border border-[#232A3B]">
                  <ArrowRightLeft className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white font-mono-num uppercase">
                    Inter-Account Transfer
                  </div>
                  <div className="text-[10px] font-mono-num text-[#64748B]">
                    Atomic zero-sum ledger debit/credit
                  </div>
                </div>
              </div>
              <span className="font-mono-num text-[10px] text-[#64748B] group-hover:text-[#00FF88]">
                TRANSFER
              </span>
            </button>

            <button
              onClick={() => {
                playSound("click", soundEnabled);
                triggerHaptic(15);
                setCsvImportOpen(true);
              }}
              className="flex items-center justify-between p-3 rounded-lg border border-[#232A3B] bg-[#0F131C] hover:border-[#FFB800]/50 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded bg-[#161B26] text-[#FFB800] border border-[#232A3B]">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white font-mono-num uppercase">
                    Import Statement
                  </div>
                  <div className="text-[10px] font-mono-num text-[#64748B]">
                    CSV mapping &amp; deduplication
                  </div>
                </div>
              </div>
              <span className="font-mono-num text-[10px] text-[#64748B] group-hover:text-[#FFB800]">
                IMPORT
              </span>
            </button>
          </div>

          {/* Central Ledger Feed */}
          <TransactionFeed />
        </div>
      )}

      {/* Analytics Tab Content */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <SpendVelocityGauge
            transactions={transactions}
            monthlyBudget={monthlyBudget}
          />
          <SankeyFlowDiagram
            transactions={transactions}
            monthlyBudget={monthlyBudget}
          />
          <HeatmapCalendar transactions={transactions} />
          <CashflowHorizonChart
            accounts={accounts}
            transactions={transactions}
            recurring={recurring}
          />
          <ExpenseTreemap
            transactions={transactions}
            categories={categories}
          />
        </div>
      )}

      {/* Accounts Tab Content */}
      {activeTab === "accounts" && <AccountDrawer />}

      {/* Vaults Tab Content */}
      {activeTab === "vaults" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#00F0FF]" />
              <h3 className="font-mono-num text-sm font-bold uppercase tracking-wider text-white">
                Capital Sinking Vaults ({vaults.length})
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  playSound("click", soundEnabled);
                  triggerHaptic(15);
                  openVaultModal();
                }}
                className="flex items-center gap-1.5 rounded border border-[#00F0FF]/60 bg-[#00F0FF]/15 px-3 py-1.5 text-xs font-mono-num font-bold text-[#00F0FF] hover:bg-[#00F0FF]/25 transition-colors shadow-[0_0_12px_rgba(0,240,255,0.15)]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>CREATE VAULT</span>
              </button>
              <button
                onClick={() => {
                  playSound("click", soundEnabled);
                  triggerHaptic(15);
                  openQuickTx({ type: "vault_deposit" });
                }}
                className="flex items-center gap-1.5 rounded border border-[#232A3B] bg-[#161B26] px-3 py-1.5 text-xs font-mono-num text-[#94A3B8] hover:text-white transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>QUICK DEPOSIT</span>
              </button>
            </div>
          </div>

          {vaults.length === 0 ? (
            <div className="industrial-card rounded-xl border border-dashed border-[#232A3B] bg-[#0F131C] p-8 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#00F0FF]/30 bg-[#00F0FF]/5 text-[#00F0FF]">
                <Shield className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold uppercase font-mono-num text-white">
                  No Sinking Vaults Configured
                </h4>
                <p className="text-xs text-[#94A3B8] font-mono-num max-w-md mx-auto">
                  Segregate long-term target savings (e.g. emergency runway, travel fund, capital equipment) with targeted deposit allocations.
                </p>
              </div>
              <button
                onClick={() => {
                  playSound("click", soundEnabled);
                  triggerHaptic(15);
                  openVaultModal();
                }}
                className="inline-flex items-center gap-1.5 rounded border border-[#00F0FF] bg-[#00F0FF]/20 px-4 py-2 text-xs font-mono-num font-bold text-[#00F0FF] hover:bg-[#00F0FF]/30 transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)]"
              >
                <Plus className="h-4 w-4" />
                <span>INITIALIZE FIRST SINKING VAULT</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {vaults.map((vault) => (
                <VaultCard key={vault.id} vault={vault} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tools Tab Content */}
      {activeTab === "tools" && <ToolsView />}
    </div>
  );
}
