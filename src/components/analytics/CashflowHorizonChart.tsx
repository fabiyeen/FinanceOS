"use client";

import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Activity, TrendingUp } from "lucide-react";
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
        // Approximate prior balance by factoring out that day's net transactions
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
    // Average daily burn estimate (excluding spikes)
    const dailyEstimatedBurn = 350000;

    for (let i = 1; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dStr = d.toISOString().split("T")[0];

      runningForward = safeSub(runningForward, dailyEstimatedBurn);

      // Check if any recurring rules fire on this day
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
    <div className="industrial-card rounded-lg border border-[#232A3B] bg-[#0F131C] p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#00FF88]" />
          <h3 className="font-mono-num text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
            Cashflow Horizon (30-Day Forward Forecast)
          </h3>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono-num">
          <span className="flex items-center gap-1 text-[#00F0FF]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00F0FF]" />
            Historical Actuals
          </span>
          <span className="flex items-center gap-1 text-[#00FF88]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00FF88]" />
            Projected Runway
          </span>
        </div>
      </div>

      <div className="h-56 sm:h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#00F0FF" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00FF88" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00FF88" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              stroke="#64748B"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: "#232A3B" }}
            />
            <YAxis
              stroke="#64748B"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: "#232A3B" }}
              tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const pt = payload[0].payload;
                const val = pt.actual !== undefined ? pt.actual : pt.projected;
                return (
                  <div className="rounded border border-[#232A3B] bg-[#07090E] p-2 font-mono-num text-xs shadow-xl">
                    <div className="text-[#64748B] text-[10px]">
                      {pt.isProjection ? "PROJECTED DATE" : "DATE"}: {pt.date}
                    </div>
                    <div
                      className={`font-bold mt-0.5 ${
                        pt.isProjection ? "text-[#00FF88]" : "text-[#00F0FF]"
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
              stroke="#00F0FF"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorActual)"
            />
            <Area
              type="monotone"
              dataKey="projected"
              stroke="#00FF88"
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
