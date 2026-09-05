"use client";

import React from "react";
import { Gauge, TrendingUp, AlertTriangle, CheckCircle, Zap } from "lucide-react";
import { computeMonthlyMetrics, formatCurrency } from "../../lib/mathEngine";
import { Transaction } from "../../lib/types";
import { useUIStore } from "../../store/useUIStore";

interface SpendVelocityGaugeProps {
  transactions: Transaction[];
  monthlyBudget: number;
}

export const SpendVelocityGauge: React.FC<SpendVelocityGaugeProps> = ({
  transactions,
  monthlyBudget,
}) => {
  const { privacyMode } = useUIStore();

  const metrics = computeMonthlyMetrics(transactions, new Date(), monthlyBudget);
  const ratio = metrics.spendVelocityRatio;

  // Status interpretation
  let statusColor = "var(--color-emerald)";
  let statusText = "Under Budget (Good)";
  if (ratio > 1.25) {
    statusColor = "var(--color-rose)";
    statusText = "High Spending Pace";
  } else if (ratio > 1.05) {
    statusColor = "var(--color-amber)";
    statusText = "Slightly Above Target";
  } else if (ratio > 0.9) {
    statusColor = "var(--color-amber)";
    statusText = "On Track";
  }

  // Gauge percentage representation (clamped to 0-100% where 1.0x = 50%)
  const gaugePercent = Math.min(100, Math.max(0, ratio * 50));

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-[var(--accent-primary)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Spending Pace &amp; Insights
          </h3>
        </div>
        <span
          className="text-[11px] font-medium px-2.5 py-0.5 rounded-md border"
          style={{
            color: statusColor,
            backgroundColor: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
            borderColor: `color-mix(in srgb, ${statusColor} 30%, transparent)`,
          }}
        >
          {statusText}
        </span>
      </div>

      {/* Speedometer Bar / Radial Visual */}
      <div className="space-y-2 mt-4">
        <div className="flex justify-between items-end text-xs">
          <div>
            <span className="text-[var(--text-muted)] text-[11px] font-medium uppercase block">Spending Pace</span>
            <span className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              {ratio.toFixed(2)}x
            </span>
          </div>

          <div className="text-right">
            <span className="text-[var(--text-muted)] text-[11px] font-medium uppercase block">Target Spend to Date</span>
            <span className={`text-xs font-semibold text-[var(--text-secondary)] ${privacyMode ? "privacy-blur" : ""}`}>
              {formatCurrency(metrics.idealSpendToDate, "IDR", "id-ID")}
            </span>
          </div>
        </div>

        {/* Velocity Gauge Bar */}
        <div className="h-2.5 w-full rounded-full bg-[var(--bg-canvas)] p-0.5 border border-[var(--border-default)] relative overflow-hidden">
          {/* Target 1.0x marker */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-[var(--text-muted)] z-10 opacity-50" title="Target (1.0x)" />
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${gaugePercent}%`,
              backgroundColor: statusColor,
            }}
          />
        </div>

        <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
          <span>0.0x (Low)</span>
          <span>1.0x (Target)</span>
          <span>2.0x+ (High)</span>
        </div>
      </div>

      {/* Burn Rate & EOM Projections Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-5 pt-4 border-t border-[var(--border-default)]">
        <div className="rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-default)] p-3">
          <div className="text-[10px] font-medium uppercase text-[var(--text-muted)]">Daily Spending Average</div>
          <div
            className={`text-xs sm:text-sm font-bold text-[var(--text-primary)] mt-1 ${
              privacyMode ? "privacy-blur" : ""
            }`}
          >
            {formatCurrency(metrics.dailyBurnRate, "IDR", "id-ID")}/day
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
            Day {metrics.currentDay} of {metrics.daysInMonth}
          </div>
        </div>

        <div className="rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-default)] p-3">
          <div className="text-[10px] font-medium uppercase text-[var(--text-muted)]">Projected Month-End Spend</div>
          <div
            className={`text-xs sm:text-sm font-bold mt-1 ${
              privacyMode ? "privacy-blur" : ""
            } ${
              metrics.projectedEOMSpend > monthlyBudget ? "text-[var(--color-rose)]" : "text-[var(--color-emerald)]"
            }`}
          >
            {formatCurrency(metrics.projectedEOMSpend, "IDR", "id-ID")}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
            Budget: {formatCurrency(monthlyBudget, "IDR", "id-ID")}
          </div>
        </div>

        <div className="rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-default)] p-3 col-span-2 sm:col-span-1">
          <div className="text-[10px] font-medium uppercase text-[var(--text-muted)]">Savings Rate</div>
          <div
            className={`text-xs sm:text-sm font-bold mt-1 ${
              metrics.savingsRate >= 20 ? "text-[var(--color-emerald)]" : "text-[var(--color-amber)]"
            }`}
          >
            {metrics.savingsRate.toFixed(1)}%
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
            Saved from Income
          </div>
        </div>
      </div>
    </div>
  );
};
