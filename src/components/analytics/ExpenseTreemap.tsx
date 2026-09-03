"use client";

import React, { useMemo } from "react";
import { PieChart, Tag } from "lucide-react";
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
    <div className="industrial-card rounded-lg border border-[#232A3B] bg-[#0F131C] p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PieChart className="h-4 w-4 text-[#00F0FF]" />
          <h3 className="font-mono-num text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
            Category Expenditure Breakdown
          </h3>
        </div>
        <span
          className={`text-xs font-mono-num font-bold text-[#FF5C00] ${
            privacyMode ? "privacy-blur" : ""
          }`}
        >
          Total: {formatCurrency(categoryBreakdown.totalExpense, "IDR", "id-ID")}
        </span>
      </div>

      <div className="space-y-3">
        {categoryBreakdown.items.length === 0 ? (
          <p className="text-xs font-mono-num text-[#64748B] text-center py-4">
            No expenses recorded for the current monthly cycle
          </p>
        ) : (
          categoryBreakdown.items.map((item) => (
            <div key={item.id} className="space-y-1">
              <div className="flex justify-between items-center text-xs font-mono-num">
                <span className="text-white flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.name}
                </span>
                <span className="text-[#94A3B8] flex items-center gap-2">
                  <span className={privacyMode ? "privacy-blur" : ""}>
                    {formatCurrency(item.amount, "IDR", "id-ID")}
                  </span>
                  <span className="text-[#00F0FF] font-bold w-12 text-right">
                    {item.percent}%
                  </span>
                </span>
              </div>

              <div className="h-1.5 w-full rounded-full bg-[#161B26] overflow-hidden">
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
