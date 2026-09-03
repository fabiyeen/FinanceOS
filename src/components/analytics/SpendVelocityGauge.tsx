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
  let statusColor = "#00FF88";
  let statusText = "OPTIMAL PACING (UNDER BUDGET)";
  if (ratio > 1.25) {
    statusColor = "#FF0055";
    statusText = "CRITICAL PACING (RAPID DEPLETION)";
  } else if (ratio > 1.05) {
    statusColor = "#FF5C00";
    statusText = "ELEVATED PACING (EXCEEDING LINEAR)";
  } else if (ratio > 0.9) {
    statusColor = "#FFB800";
    statusText = "ON TRACK (NOMINAL TRAJECTORY)";
  }

  // Gauge percentage representation (clamped to 0-100% where 1.0x = 50%)
  const gaugePercent = Math.min(100, Math.max(0, ratio * 50));

  return (
    <div className="industrial-card rounded-lg border border-[#232A3B] bg-[#0F131C] p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-[#FFB800]" />
          <h3 className="font-mono-num text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
            Spend Velocity &amp; Burn Horizon
          </h3>
        </div>
        <span
          className="text-[10px] font-mono-num uppercase font-bold px-2 py-0.5 rounded border"
          style={{
            color: statusColor,
            backgroundColor: `${statusColor}15`,
            borderColor: `${statusColor}40`,
          }}
        >
          {statusText}
        </span>
      </div>

      {/* Speedometer Bar / Radial Visual */}
      <div className="space-y-2 mt-4">
        <div className="flex justify-between items-end text-xs font-mono-num">
          <div>
            <span className="text-[#64748B] text-[10px] uppercase block">BURN VELOCITY</span>
            <span className="text-xl sm:text-2xl font-bold text-white">
              {ratio.toFixed(2)}x
            </span>
          </div>

          <div className="text-right">
            <span className="text-[#64748B] text-[10px] uppercase block">IDEAL BURN TO DATE</span>
            <span className={`text-xs font-bold text-[#94A3B8] ${privacyMode ? "privacy-blur" : ""}`}>
              {formatCurrency(metrics.idealSpendToDate, "IDR", "id-ID")}
            </span>
          </div>
        </div>

        {/* Velocity Gauge Bar */}
        <div className="h-3 w-full rounded-full bg-[#07090E] p-0.5 border border-[#232A3B] relative overflow-hidden">
          {/* Target 1.0x marker */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/40 z-10" title="Target Pacing (1.0x)" />
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${gaugePercent}%`,
              backgroundColor: statusColor,
              boxShadow: `0 0 10px ${statusColor}`,
            }}
          />
        </div>

        <div className="flex justify-between text-[9px] font-mono-num text-[#64748B]">
          <span>0.0x (Static)</span>
          <span>1.0x (Ideal Linear)</span>
          <span>2.0x+ (Overburn)</span>
        </div>
      </div>

      {/* Burn Rate & EOM Projections Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-5 pt-4 border-t border-[#232A3B]">
        <div className="rounded bg-[#07090E] border border-[#232A3B] p-2.5">
          <div className="text-[9px] font-mono-num uppercase text-[#64748B]">Daily Burn Rate</div>
          <div
            className={`font-mono-num text-xs sm:text-sm font-bold text-white mt-0.5 ${
              privacyMode ? "privacy-blur" : ""
            }`}
          >
            {formatCurrency(metrics.dailyBurnRate, "IDR", "id-ID")}/day
          </div>
          <div className="text-[9px] font-mono-num text-[#94A3B8] mt-0.5">
            Day {metrics.currentDay} of {metrics.daysInMonth}
          </div>
        </div>

        <div className="rounded bg-[#07090E] border border-[#232A3B] p-2.5">
          <div className="text-[9px] font-mono-num uppercase text-[#64748B]">Projected EOM Spend</div>
          <div
            className={`font-mono-num text-xs sm:text-sm font-bold mt-0.5 ${
              privacyMode ? "privacy-blur" : ""
            } ${
              metrics.projectedEOMSpend > monthlyBudget ? "text-[#FF5C00]" : "text-[#00FF88]"
            }`}
          >
            {formatCurrency(metrics.projectedEOMSpend, "IDR", "id-ID")}
          </div>
          <div className="text-[9px] font-mono-num text-[#94A3B8] mt-0.5">
            Budget: {formatCurrency(monthlyBudget, "IDR", "id-ID")}
          </div>
        </div>

        <div className="rounded bg-[#07090E] border border-[#232A3B] p-2.5 col-span-2 sm:col-span-1">
          <div className="text-[9px] font-mono-num uppercase text-[#64748B]">Net Savings Rate</div>
          <div
            className={`font-mono-num text-xs sm:text-sm font-bold mt-0.5 ${
              metrics.savingsRate >= 20 ? "text-[#00FF88]" : "text-[#FFB800]"
            }`}
          >
            {metrics.savingsRate.toFixed(1)}%
          </div>
          <div className="text-[9px] font-mono-num text-[#94A3B8] mt-0.5">
            Retained from Inflow
          </div>
        </div>
      </div>
    </div>
  );
};
