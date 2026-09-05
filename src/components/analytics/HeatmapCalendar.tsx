"use client";

import React, { useMemo, useState } from "react";
import { Calendar, Flame } from "lucide-react";
import { Transaction } from "../../lib/types";
import { formatCurrency, safeAdd } from "../../lib/mathEngine";
import { useUIStore } from "../../store/useUIStore";

interface HeatmapCalendarProps {
  transactions: Transaction[];
}

export const HeatmapCalendar: React.FC<HeatmapCalendarProps> = ({ transactions }) => {
  const { privacyMode } = useUIStore();
  const [hoveredDay, setHoveredDay] = useState<{ date: string; amount: number } | null>(null);

  // Generate 84 days (12 weeks) of calendar cells leading up to today
  const { days, maxSpend } = useMemo(() => {
    const dailyMap: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.type === "expense") {
        dailyMap[tx.date] = safeAdd(dailyMap[tx.date] || 0, tx.amount);
      }
    }

    const today = new Date();
    const result: { date: string; amount: number; dayOfWeek: number }[] = [];
    let max = 1;

    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const amt = dailyMap[dateStr] || 0;
      if (amt > max) max = amt;
      result.push({
        date: dateStr,
        amount: amt,
        dayOfWeek: d.getDay(),
      });
    }

    return { days: result, maxSpend: max };
  }, [transactions]);

  // Determine heat level
  const getLevelColor = (amount: number) => {
    if (amount === 0) return "var(--heatmap-empty, rgba(255, 255, 255, 0.05))";
    const ratio = amount / maxSpend;
    if (ratio < 0.25) return "rgba(16, 185, 129, 0.35)";
    if (ratio < 0.5) return "rgba(16, 185, 129, 0.75)";
    if (ratio < 0.75) return "#06B6D4";
    return "#F43F5E";
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] p-5 sm:p-6 shadow-sm overflow-hidden transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Daily Spending Activity (12-Week Heatmap)
          </h3>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono-num text-[var(--text-muted)]">
          <span>Less</span>
          <span className="h-2.5 w-2.5 rounded-sm bg-white/[0.06] light:bg-slate-200 border border-white/[0.06] dark:border-white/[0.06] light:border-slate-300" />
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/35" />
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/75" />
          <span className="h-2.5 w-2.5 rounded-sm bg-cyan-500" />
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
          <span>More</span>
        </div>
      </div>

      {/* Grid Canvas */}
      <div className="overflow-x-auto pb-1">
        <div className="inline-grid grid-rows-7 grid-flow-col gap-1.5 p-2 bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-100 rounded-xl border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200">
          {days.map((d) => (
            <div
              key={d.date}
              onMouseEnter={() => setHoveredDay({ date: d.date, amount: d.amount })}
              onMouseLeave={() => setHoveredDay(null)}
              className="h-3.5 w-3.5 rounded-xs transition-transform hover:scale-125 cursor-pointer"
              style={{
                backgroundColor: getLevelColor(d.amount),
              }}
            />
          ))}
        </div>
      </div>

      {/* Hover Status Readout */}
      <div className="mt-3 pt-3 border-t border-white/[0.06] dark:border-white/[0.06] light:border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono-num">
        <div className="text-[var(--text-secondary)]">
          {hoveredDay ? (
            <span className="font-medium text-[var(--text-primary)]">
              {hoveredDay.date} •{" "}
              <span className={`text-emerald-500 tabular-nums ${privacyMode ? "privacy-blur" : ""}`}>
                {hoveredDay.amount > 0
                  ? formatCurrency(hoveredDay.amount, "IDR", "id-ID")
                  : "Zero Spend Day"}
              </span>
            </span>
          ) : (
            <span className="text-[var(--text-muted)]">Hover over any block to view daily spending</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[11px]">
          <Flame className="h-3.5 w-3.5 text-rose-500" />
          <span>Peak: <span className="tabular-nums font-semibold text-[var(--text-secondary)]">{formatCurrency(maxSpend, "IDR", "id-ID")}</span></span>
        </div>
      </div>
    </div>
  );
};
