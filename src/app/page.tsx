"use client";

import React, { useEffect } from "react";
import {
  Hourglass,
  Percent,
  Plus,
  ArrowRightLeft,
  FileSpreadsheet,
  Zap,
  Shield,
  CreditCard,
  Target,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useUIStore, NavTab } from "../store/useUIStore";
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
    setActiveTab,
    privacyMode,
    soundEnabled,
    openQuickTx,
    setCmdBarOpen,
    setCsvImportOpen,
    openVaultModal,
  } = useUIStore();

  // Route fallback: ensure valid tab defaults to overview
  useEffect(() => {
    const validTabs: NavTab[] = ["overview", "analytics", "accounts", "vaults", "tools"];
    if (!validTabs.includes(activeTab)) {
      setActiveTab("overview");
    }
  }, [activeTab, setActiveTab]);

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

  // Financial Engine Calculations
  const netWorth = calculateNetWorth(accounts, vaults, debts);
  const metrics = computeMonthlyMetrics(transactions, new Date(), monthlyBudget);
  const runway = calculateRunway(accounts, transactions, new Date());
  const debtRatio = calculateDebtToAssetRatio(accounts, debts, netWorth);

  return (
    <div className="space-y-6">
      {/* Overview Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Welcoming Card for First-Time / Empty State */}
          {transactions.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--card-bg)] p-8 sm:p-12 text-center space-y-4 shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                <Sparkles className="h-7 w-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  Welcome to FinanceOS
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Your offline-first, double-entry financial operating system. Record your first transaction or import a statement to begin tracking your cash flow and savings goals.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    playSound("click", soundEnabled);
                    triggerHaptic(20);
                    openQuickTx();
                  }}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-2.5 text-sm transition-all shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>+ Add First Transaction</span>
                </button>
                <button
                  onClick={() => {
                    playSound("click", soundEnabled);
                    setCsvImportOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] font-medium px-4 py-2.5 text-sm transition-all"
                >
                  <FileSpreadsheet className="h-4 w-4 text-[var(--text-muted)]" />
                  <span>Import Statement (CSV)</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Top Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Monthly Spending */}
                <div className="rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] p-4 sm:p-5 shadow-xs transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                      <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                      Monthly Spending
                    </span>
                    <span className="text-[11px] font-mono-num text-[var(--text-secondary)]">
                      {metrics.spendVelocityRatio <= 1 ? "On Track" : `${metrics.spendVelocityRatio.toFixed(1)}x Pace`}
                    </span>
                  </div>
                  <div
                    className={`font-mono-num text-lg sm:text-2xl font-bold text-[var(--text-primary)] mt-2 tabular-nums ${
                      privacyMode ? "privacy-blur" : ""
                    }`}
                  >
                    {formatCurrency(metrics.spentThisMonth, currency, locale)}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-1 truncate font-mono-num tabular-nums">
                    Budget: {formatCurrency(monthlyBudget, currency, locale)}
                  </div>
                </div>

                {/* 2. Runway Calculator */}
                <div className="rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] p-4 sm:p-5 shadow-xs transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                      <Hourglass className="h-3.5 w-3.5 text-emerald-500" />
                      Financial Runway
                    </span>
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                      Liquid
                    </span>
                  </div>
                  <div className="font-mono-num text-lg sm:text-2xl font-bold text-emerald-500 mt-2 tabular-nums">
                    {runway.runwayMonths} Months
                  </div>
                  <div
                    className={`text-xs text-[var(--text-muted)] mt-1 truncate font-mono-num tabular-nums ${
                      privacyMode ? "privacy-blur" : ""
                    }`}
                  >
                    Reserves: {formatCurrency(runway.liquidReserves, currency, locale)}
                  </div>
                </div>

                {/* 3. Savings Rate */}
                <div className="rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] p-4 sm:p-5 shadow-xs transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                      <Percent className="h-3.5 w-3.5 text-blue-500" />
                      Savings Rate
                    </span>
                    <span className="text-[11px] font-mono-num text-blue-500 font-medium">
                      {metrics.savingsRate >= 20 ? "Target Met" : "Pacing"}
                    </span>
                  </div>
                  <div className="font-mono-num text-lg sm:text-2xl font-bold text-[var(--text-primary)] mt-2 tabular-nums">
                    {metrics.savingsRate.toFixed(1)}%
                  </div>
                  <div
                    className={`text-xs text-[var(--text-muted)] mt-1 truncate font-mono-num tabular-nums ${
                      privacyMode ? "privacy-blur" : ""
                    }`}
                  >
                    Income: {formatCurrency(metrics.incomeThisMonth, currency, locale)}
                  </div>
                </div>

                {/* 4. Debt-to-Asset Ratio */}
                <div className="rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] p-4 sm:p-5 shadow-xs transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-amber-500" />
                      Debt-to-Asset
                    </span>
                    <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                      {debtRatio < 30 ? "Prudent" : "Elevated"}
                    </span>
                  </div>
                  <div className="font-mono-num text-lg sm:text-2xl font-bold text-[var(--text-primary)] mt-2 tabular-nums">
                    {debtRatio.toFixed(1)}%
                  </div>
                  <div className="text-xs text-emerald-500 font-medium mt-1 truncate">
                    {debtRatio < 30 ? "Low leverage posture" : "Review liabilities"}
                  </div>
                </div>
              </div>

              {/* Quick Action Matrix Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => {
                    playSound("click", soundEnabled);
                    triggerHaptic(15);
                    setCmdBarOpen(true);
                  }}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] hover:border-white/[0.14] transition-all group shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-100 text-[var(--text-primary)] border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200">
                      <Zap className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-semibold text-[var(--text-primary)]">
                        Command Bar
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        Fast search &amp; actions
                      </div>
                    </div>
                  </div>
                  <span className="font-mono-num text-[11px] text-[var(--text-muted)] group-hover:text-[var(--text-primary)]">
                    Cmd+K
                  </span>
                </button>

                <button
                  onClick={() => {
                    playSound("click", soundEnabled);
                    triggerHaptic(15);
                    openQuickTx({ type: "transfer" });
                  }}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] hover:border-white/[0.14] transition-all group shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-100 text-[var(--text-primary)] border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200">
                      <ArrowRightLeft className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-semibold text-[var(--text-primary)]">
                        Transfer Funds
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        Move money between accounts
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-[var(--text-muted)] group-hover:text-emerald-500">
                    Transfer
                  </span>
                </button>

                <button
                  onClick={() => {
                    playSound("click", soundEnabled);
                    triggerHaptic(15);
                    setCsvImportOpen(true);
                  }}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] hover:border-white/[0.14] transition-all group shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-100 text-[var(--text-primary)] border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200">
                      <FileSpreadsheet className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-semibold text-[var(--text-primary)]">
                        Import Statement
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        Import CSV statements
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-[var(--text-muted)] group-hover:text-blue-500">
                    Import
                  </span>
                </button>
              </div>

              {/* Tablet & Desktop Adaptive Layout */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* Primary Column: Recent Activity Feed */}
                <div className="md:col-span-7 lg:col-span-8 space-y-6">
                  <TransactionFeed />
                </div>

                {/* Secondary Column: Spending Insights & Savings Goals */}
                <div className="md:col-span-5 lg:col-span-4 space-y-6">
                  <SpendVelocityGauge
                    transactions={transactions}
                    monthlyBudget={monthlyBudget}
                  />

                  {/* Savings Goals Snapshot */}
                  <div className="rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] p-5 space-y-3 shadow-sm transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-emerald-500" />
                        <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                          Savings Goals ({vaults.length})
                        </h4>
                      </div>
                      <button
                        onClick={() => {
                          playSound("click", soundEnabled);
                          openVaultModal();
                        }}
                        className="text-xs text-emerald-500 hover:text-emerald-400 font-medium"
                      >
                        + New Goal
                      </button>
                    </div>

                    {vaults.length === 0 ? (
                      <div className="text-center py-6 border border-dashed border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 rounded-xl">
                        <p className="text-xs text-[var(--text-muted)]">No savings goals yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {vaults.slice(0, 3).map((vault) => {
                          const progress =
                            vault.targetAmount > 0
                              ? Math.min(
                                  100,
                                  Math.round((vault.currentAmount / vault.targetAmount) * 100)
                                )
                              : 0;
                          return (
                            <div
                              key={vault.id}
                              className="p-3 rounded-xl border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200 bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-50 space-y-2 transition-colors"
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium text-[var(--text-primary)] truncate max-w-[150px]">
                                  {vault.title}
                                </span>
                                <span className="font-mono-num font-semibold text-emerald-500 tabular-nums">
                                  {progress}%
                                </span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-white/[0.05] dark:bg-white/[0.05] light:bg-slate-200 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{
                                    width: `${progress}%`,
                                    backgroundColor: vault.color || "#10B981",
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
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

      {/* Vaults / Savings Goals Tab Content */}
      {activeTab === "vaults" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Savings Goals ({vaults.length})
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  playSound("click", soundEnabled);
                  triggerHaptic(15);
                  openVaultModal();
                }}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Savings Goal</span>
              </button>
              <button
                onClick={() => {
                  playSound("click", soundEnabled);
                  triggerHaptic(15);
                  openQuickTx({ type: "vault_deposit" });
                }}
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-slate-100 px-3.5 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Deposit</span>
              </button>
            </div>
          </div>

          {vaults.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] p-8 text-center space-y-4 shadow-xs">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                <Target className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                  No Savings Goals Yet
                </h4>
                <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
                  Set aside money for specific milestones like an emergency fund, travel, or capital purchases.
                </p>
              </div>
              <button
                onClick={() => {
                  playSound("click", soundEnabled);
                  triggerHaptic(15);
                  openVaultModal();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition-all shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>New Savings Goal</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vaults.map((vault) => (
                <VaultCard key={vault.id} vault={vault} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tools / Settings Tab Content */}
      {activeTab === "tools" && <ToolsView />}
    </div>
  );
}
