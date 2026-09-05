"use client";

import React from "react";
import { Gauge } from "lucide-react";
import { computeMonthlyMetrics, formatCurrency } from "../../lib/mathEngine";
import { Transaction } from "../../lib/types";
import { useUIStore } from "../../store/useUIStore";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";

interface SpendVelocityGaugeProps {
  transactions: Transaction[];
  monthlyBudget: number;
  currency?: string;
  locale?: string;
  variant?: "compact" | "wide";
}

export const SpendVelocityGauge: React.FC<SpendVelocityGaugeProps> = ({
  transactions,
  monthlyBudget,
  currency,
  locale,
  variant = "compact",
}) => {
  const { privacyMode } = useUIStore();
  const settings = useLiveQuery(() => db.settings.get("main"));

  const activeCurrency = currency || settings?.currency || "IDR";
  const activeLocale = locale || settings?.locale || "id-ID";

  const metrics = computeMonthlyMetrics(transactions, new Date(), monthlyBudget);
  const ratio = metrics.spendVelocityRatio;

  // Status interpretation
  let statusColor = "#10B981";
  let statusBg = "rgba(16, 185, 129, 0.12)";
  let statusBorder = "rgba(16, 185, 129, 0.25)";
  let statusText = "Under Budget (Good)";

  if (ratio > 1.3) {
    statusColor = "#F43F5E";
    statusBg = "rgba(244, 63, 94, 0.12)";
    statusBorder = "rgba(244, 63, 94, 0.25)";
    statusText = "High Spending Pace";
  } else if (ratio > 1.05) {
    statusColor = "#F59E0B";
    statusBg = "rgba(245, 158, 11, 0.12)";
    statusBorder = "rgba(245, 158, 11, 0.25)";
    statusText = "Slightly Above Target";
  } else if (ratio > 0.9) {
    statusColor = "#10B981";
    statusBg = "rgba(16, 185, 129, 0.12)";
    statusBorder = "rgba(16, 185, 129, 0.25)";
    statusText = "On Track";
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] p-5 sm:p-6 shadow-sm overflow-hidden transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Spending Pace &amp; Insights
          </h3>
        </div>
        <span
          className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-colors"
          style={{
            color: statusColor,
            backgroundColor: statusBg,
            borderColor: statusBorder,
          }}
        >
          {statusText}
        </span>
      </div>

      {/* Speedometer Bar / Radial Visual */}
      <div className="space-y-3 mt-4">
        <div className="flex justify-between items-end text-xs">
          <div>
            <span className="text-[var(--text-muted)] text-[11px] font-medium uppercase tracking-wider block">
              Spending Pace
            </span>
            <span className="font-mono-num text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              {ratio.toFixed(2)}x
            </span>
          </div>

          <div className="text-right">
            <span className="text-[var(--text-muted)] text-[11px] font-medium uppercase tracking-wider block">
              Target Spend to Date
            </span>
            <span
              className={`font-mono-num text-xs sm:text-sm font-semibold text-[var(--text-secondary)] tabular-nums ${
                privacyMode ? "privacy-blur" : ""
              }`}
            >
              {formatCurrency(metrics.idealSpendToDate, activeCurrency, activeLocale)}
            </span>
          </div>
        </div>

        {/* Progress Gauge & Scale Labels (Constrained Container) */}
        <div className="w-full space-y-2 py-1">
          {/* Target Bar Track */}
          <div className="relative w-full h-2.5 rounded-full bg-white/[0.06] light:bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(Math.max(ratio * 50, 0), 100)}%`,
                backgroundColor: ratio <= 1.0 ? "#10B981" : ratio <= 1.3 ? "#F59E0B" : "#F43F5E",
              }}
            />
            {/* Midpoint Target Pin */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/40 light:bg-slate-400" />
          </div>

          {/* Scale Labels - Guaranteed inside container */}
          <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 light:text-slate-500">
            <span>0.0x (Low)</span>
            <span className="text-center">1.0x (Target)</span>
            <span className="text-right">2.0x+ (High)</span>
          </div>
        </div>
      </div>

      {/* Burn Rate & EOM Projections Grid / List */}
      {variant === "compact" ? (
        <div className="space-y-2 mt-5 pt-4 border-t border-white/[0.06] dark:border-white/[0.06] light:border-slate-200">
          {/* Daily Spending Average */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] dark:bg-white/[0.03] dark:border-white/[0.06] light:bg-slate-50 light:border-slate-200/70 transition-colors">
            <div className="min-w-0 pr-3">
              <div className="text-[11px] font-medium text-[var(--text-muted)]">
                Daily Spending Average
              </div>
              <div className="text-[10px] text-[var(--text-muted)] font-mono-num mt-0.5">
                Day {metrics.currentDay} of {metrics.daysInMonth}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div
                className={`font-mono-num text-xs sm:text-sm font-bold text-[var(--text-primary)] tabular-nums ${
                  privacyMode ? "privacy-blur" : ""
                }`}
              >
                {formatCurrency(metrics.dailyBurnRate, activeCurrency, activeLocale)}
                <span className="text-[10px] font-normal text-[var(--text-muted)] ml-0.5">/day</span>
              </div>
            </div>
          </div>

          {/* Projected Month-End Spend */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] dark:bg-white/[0.03] dark:border-white/[0.06] light:bg-slate-50 light:border-slate-200/70 transition-colors">
            <div className="min-w-0 pr-3">
              <div className="text-[11px] font-medium text-[var(--text-muted)]">
                Projected Month-End
              </div>
              <div className="text-[10px] text-[var(--text-muted)] font-mono-num mt-0.5 truncate">
                Budget: {formatCurrency(monthlyBudget, activeCurrency, activeLocale)}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div
                className={`font-mono-num text-xs sm:text-sm font-bold tabular-nums ${
                  privacyMode ? "privacy-blur" : ""
                } ${
                  metrics.projectedEOMSpend > monthlyBudget
                    ? "text-[var(--color-rose)]"
                    : "text-[var(--color-emerald)]"
                }`}
              >
                {formatCurrency(metrics.projectedEOMSpend, activeCurrency, activeLocale)}
              </div>
            </div>
          </div>

          {/* Savings Rate */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] dark:bg-white/[0.03] dark:border-white/[0.06] light:bg-slate-50 light:border-slate-200/70 transition-colors">
            <div className="min-w-0 pr-3">
              <div className="text-[11px] font-medium text-[var(--text-muted)]">
                Savings Rate
              </div>
              <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                Saved from Income
              </div>
            </div>
            <div className="text-right shrink-0">
              <div
                className={`font-mono-num text-xs sm:text-sm font-bold tabular-nums ${
                  metrics.savingsRate >= 20
                    ? "text-[var(--color-emerald)]"
                    : "text-[var(--color-amber)]"
                }`}
              >
                {metrics.savingsRate.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-5 pt-4 border-t border-white/[0.06] dark:border-white/[0.06] light:border-slate-200">
          {/* Daily Spending Average */}
          <div className="min-w-0 rounded-xl p-3.5 sm:p-4 bg-white/[0.03] border border-white/[0.06] dark:bg-white/[0.03] dark:border-white/[0.06] light:bg-slate-50 light:border-slate-200/70 transition-colors">
            <div className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Daily Spending Average
            </div>
            <div
              className={`font-mono-num text-sm sm:text-base font-bold text-[var(--text-primary)] mt-1.5 tabular-nums truncate ${
                privacyMode ? "privacy-blur" : ""
              }`}
            >
              {formatCurrency(metrics.dailyBurnRate, activeCurrency, activeLocale)}
              <span className="text-xs font-normal text-[var(--text-muted)] ml-0.5">/day</span>
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-1 font-mono-num truncate">
              Day {metrics.currentDay} of {metrics.daysInMonth}
            </div>
          </div>

          {/* Projected Month-End Spend */}
          <div className="min-w-0 rounded-xl p-3.5 sm:p-4 bg-white/[0.03] border border-white/[0.06] dark:bg-white/[0.03] dark:border-white/[0.06] light:bg-slate-50 light:border-slate-200/70 transition-colors">
            <div className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Projected Month-End Spend
            </div>
            <div
              className={`font-mono-num text-sm sm:text-base font-bold mt-1.5 tabular-nums truncate ${
                privacyMode ? "privacy-blur" : ""
              } ${
                metrics.projectedEOMSpend > monthlyBudget
                  ? "text-[var(--color-rose)]"
                  : "text-[var(--color-emerald)]"
              }`}
            >
              {formatCurrency(metrics.projectedEOMSpend, activeCurrency, activeLocale)}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-1 font-mono-num truncate">
              Budget: {formatCurrency(monthlyBudget, activeCurrency, activeLocale)}
            </div>
          </div>

          {/* Savings Rate */}
          <div className="min-w-0 rounded-xl p-3.5 sm:p-4 bg-white/[0.03] border border-white/[0.06] dark:bg-white/[0.03] dark:border-white/[0.06] light:bg-slate-50 light:border-slate-200/70 transition-colors">
            <div className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Savings Rate
            </div>
            <div
              className={`font-mono-num text-sm sm:text-base font-bold mt-1.5 tabular-nums truncate ${
                metrics.savingsRate >= 20
                  ? "text-[var(--color-emerald)]"
                  : "text-[var(--color-amber)]"
              }`}
            >
              {metrics.savingsRate.toFixed(1)}%
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-1 truncate">
              Saved from Income
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
