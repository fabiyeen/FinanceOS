"use client";

import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Activity } from "lucide-react";
import { Account, RecurringRule, Transaction } from "../../lib/types";
import { formatCurrency, safeAdd, safeSub } from "../../lib/mathEngine";
import { useUIStore } from "../../store/useUIStore";

interface CashflowHorizonProps {
  accounts: Account[];
  transactions: Transaction[];
  recurring: RecurringRule[];
}

export const CashflowHorizonChart: React.FC<CashflowHorizonProps> = ({
  accounts,
  transactions,
  recurring,
}) => {
  const { privacyMode } = useUIStore();

  // Current liquid cash balance
  const currentLiquid = useMemo(() => {
    let sum = 0;
    for (const a of accounts) {
      if (!a.isArchived && a.type !== "credit") {
        sum = safeAdd(sum, a.currentBalance);
      }
    }
    return sum;
  }, [accounts]);

  // Construct 15 days historical actuals + 30 days forward projection
  const data = useMemo(() => {
    const points: { date: string; actual?: number; projected?: number; isProjection?: boolean }[] = [];
    const today = new Date();

    // 15 days historical actual balance curve estimation
    let runningBackwards = currentLiquid;
    const historyPoints: { date: string; actual: number }[] = [];

    for (let i = 0; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split("T")[0];

      if (i === 0) {
        historyPoints.unshift({ date: dStr.substring(5), actual: currentLiquid });
      } else {
        const dayTxs = transactions.filter((t) => t.date === dStr);
        let dayNet = 0;
        for (const t of dayTxs) {
          if (t.type === "income") dayNet = safeAdd(dayNet, t.amount);
          else if (t.type === "expense") dayNet = safeSub(dayNet, t.amount);
        }
        runningBackwards = safeSub(runningBackwards, dayNet);
        historyPoints.unshift({ date: dStr.substring(5), actual: Math.max(0, runningBackwards) });
      }
    }

    points.push(...historyPoints);

    // 30 days forward projection
    let runningForward = currentLiquid;
    const dailyEstimatedBurn = 350000;

    for (let i = 1; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dStr = d.toISOString().split("T")[0];

      runningForward = safeSub(runningForward, dailyEstimatedBurn);

      for (const r of recurring) {
        if (r.nextRunDate === dStr) {
          if (r.type === "income") {
            runningForward = safeAdd(runningForward, r.amount);
          } else {
            runningForward = safeSub(runningForward, r.amount);
          }
        }
      }

      points.push({
        date: dStr.substring(5),
        projected: Math.max(0, runningForward),
        isProjection: true,
      });
    }

    return points;
  }, [currentLiquid, transactions, recurring]);

  return (
    <div className="rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] p-5 sm:p-6 shadow-sm overflow-hidden transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Cashflow Horizon (30-Day Forecast)
          </h3>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono-num">
          <span className="flex items-center gap-1.5 text-cyan-400">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            Historical Actuals
          </span>
          <span className="flex items-center gap-1.5 text-emerald-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Projected Runway
          </span>
        </div>
      </div>

      <div className="h-56 sm:h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              stroke="#64748B"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#64748B"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const pt = payload[0].payload;
                const val = pt.actual !== undefined ? pt.actual : pt.projected;
                return (
                  <div className="rounded-xl border border-white/[0.1] dark:border-white/[0.1] light:border-slate-200 bg-[var(--bg-surface)] p-2.5 font-mono-num text-xs shadow-xl">
                    <div className="text-[var(--text-muted)] text-[10px]">
                      {pt.isProjection ? "PROJECTED DATE" : "DATE"}: {pt.date}
                    </div>
                    <div
                      className={`font-bold mt-0.5 tabular-nums ${
                        pt.isProjection ? "text-emerald-500" : "text-cyan-400"
                      } ${privacyMode ? "privacy-blur" : ""}`}
                    >
                      {formatCurrency(val, "IDR", "id-ID")}
                    </div>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#06B6D4"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorActual)"
            />
            <Area
              type="monotone"
              dataKey="projected"
              stroke="#10B981"
              strokeDasharray="4 4"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorProjected)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
