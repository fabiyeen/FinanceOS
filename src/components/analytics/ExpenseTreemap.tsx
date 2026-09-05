"use client";

import React, { useMemo } from "react";
import { PieChart } from "lucide-react";
import { Category, Transaction } from "../../lib/types";
import { formatCurrency, safeAdd } from "../../lib/mathEngine";
import { useUIStore } from "../../store/useUIStore";

interface ExpenseTreemapProps {
  transactions: Transaction[];
  categories: Category[];
}

export const ExpenseTreemap: React.FC<ExpenseTreemapProps> = ({
  transactions,
  categories,
}) => {
  const { privacyMode } = useUIStore();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const categoryBreakdown = useMemo(() => {
    const catMap = new Map<string, number>();
    let totalExpense = 0;

    for (const tx of transactions) {
      const [y, m] = tx.date.split("-").map(Number);
      if (y === currentYear && m === currentMonth + 1 && tx.type === "expense") {
        catMap.set(tx.categoryId, safeAdd(catMap.get(tx.categoryId) || 0, tx.amount));
        totalExpense = safeAdd(totalExpense, tx.amount);
      }
    }

    const items = categories
      .map((cat) => {
        const amount = catMap.get(cat.id) || 0;
        const percent = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
        return {
          ...cat,
          amount,
          percent: Math.round(percent * 10) / 10,
        };
      })
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return { items, totalExpense };
  }, [transactions, categories, currentYear, currentMonth]);

  return (
    <div className="rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] p-5 sm:p-6 shadow-sm overflow-hidden transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PieChart className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Category Spending Breakdown
          </h3>
        </div>
        <span
          className={`text-xs font-mono-num font-bold text-rose-500 tabular-nums ${
            privacyMode ? "privacy-blur" : ""
          }`}
        >
          Total: {formatCurrency(categoryBreakdown.totalExpense, "IDR", "id-ID")}
        </span>
      </div>

      <div className="space-y-3.5">
        {categoryBreakdown.items.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center py-6">
            No expenses recorded for this month
          </p>
        ) : (
          categoryBreakdown.items.map((item) => (
            <div key={item.id} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-primary)] font-medium flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate max-w-[160px] sm:max-w-xs">{item.name}</span>
                </span>
                <span className="text-[var(--text-secondary)] flex items-center gap-3 font-mono-num">
                  <span className={`tabular-nums ${privacyMode ? "privacy-blur" : ""}`}>
                    {formatCurrency(item.amount, "IDR", "id-ID")}
                  </span>
                  <span className="text-emerald-500 font-semibold w-12 text-right tabular-nums">
                    {item.percent}%
                  </span>
                </span>
              </div>

              <div className="h-2 w-full rounded-full bg-white/[0.05] dark:bg-white/[0.05] light:bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${item.percent}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
