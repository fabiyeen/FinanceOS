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

    // 84 days back
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

  // Determine heat level 0 - 4
  const getLevelColor = (amount: number) => {
    if (amount === 0) return "#161B26"; // Void surface
    const ratio = amount / maxSpend;
    if (ratio < 0.25) return "rgba(0, 255, 136, 0.4)"; // Low (Emerald)
    if (ratio < 0.5) return "#00FF88"; // Moderate (Emerald solid)
    if (ratio < 0.75) return "#00F0FF"; // Heavy (Cyan)
    return "#FF5C00"; // Peak burn (Safety Orange)
  };

  return (
    <div className="industrial-card rounded-lg border border-[#232A3B] bg-[#0F131C] p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#00F0FF]" />
          <h3 className="font-mono-num text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
            Daily Spend Intensity (12-Week Matrix)
          </h3>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1 text-[9px] font-mono-num text-[#64748B]">
          <span>LESS</span>
          <span className="h-2 w-2 rounded-sm bg-[#161B26]" />
          <span className="h-2 w-2 rounded-sm bg-[#00FF88]/40" />
          <span className="h-2 w-2 rounded-sm bg-[#00FF88]" />
          <span className="h-2 w-2 rounded-sm bg-[#00F0FF]" />
          <span className="h-2 w-2 rounded-sm bg-[#FF5C00]" />
          <span>MORE</span>
        </div>
      </div>

      {/* Grid Canvas */}
      <div className="overflow-x-auto pb-1">
        <div className="inline-grid grid-rows-7 grid-flow-col gap-1.5 p-1 bg-[#07090E] rounded border border-[#232A3B]">
          {days.map((d) => (
            <div
              key={d.date}
              onMouseEnter={() => setHoveredDay({ date: d.date, amount: d.amount })}
              onMouseLeave={() => setHoveredDay(null)}
              className="h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-xs transition-transform hover:scale-125 cursor-pointer"
              style={{
                backgroundColor: getLevelColor(d.amount),
                boxShadow: d.amount > 0 ? `0 0 4px ${getLevelColor(d.amount)}` : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* Hover Status Readout */}
      <div className="mt-3 pt-2 border-t border-[#232A3B]/60 flex items-center justify-between text-xs font-mono-num">
        <div className="text-[#64748B]">
          {hoveredDay ? (
            <span className="text-white font-medium">
              {hoveredDay.date} •{" "}
              <span className={`text-[#00F0FF] ${privacyMode ? "privacy-blur" : ""}`}>
                {hoveredDay.amount > 0
                  ? formatCurrency(hoveredDay.amount, "IDR", "id-ID")
                  : "Zero Spend Day"}
              </span>
            </span>
          ) : (
            <span>Hover over any block to view daily cash dissipation</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[#94A3B8] text-[10px]">
          <Flame className="h-3 w-3 text-[#FF5C00]" />
          <span>Peak: {formatCurrency(maxSpend, "IDR", "id-ID")}</span>
        </div>
      </div>
    </div>
  );
};
