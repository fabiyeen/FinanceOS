"use client";

import React, { useState } from "react";
import { Download, X, Check, FileSpreadsheet } from "lucide-react";
import { useUIStore } from "../../store/useUIStore";
import { downloadCsvFile, exportToCsv } from "../../lib/csvEngine";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";

export const CsvExportModal: React.FC = () => {
  const { isCsvExportOpen, setCsvExportOpen, soundEnabled } = useUIStore();

  const transactions = useLiveQuery(() => db.transactions.toArray()) ?? [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.get("main"));

  const currency = settings?.currency || "IDR";

  const [dateFilter, setDateFilter] = useState<"all" | "this_month" | "this_year">("this_month");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

  if (!isCsvExportOpen) return null;

  const handleExport = () => {
    playSound("click", soundEnabled);
    triggerHaptic(20);

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    const filtered = transactions.filter((t) => {
      if (selectedAccountId !== "all" && t.fromAccountId !== selectedAccountId && t.toAccountId !== selectedAccountId) {
        return false;
      }
      if (selectedCategoryId !== "all" && t.categoryId !== selectedCategoryId) {
        return false;
      }
      if (dateFilter === "this_month") {
        const [y, m] = t.date.split("-").map(Number);
        return y === currentYear && m === currentMonth + 1;
      }
      if (dateFilter === "this_year") {
        const [y] = t.date.split("-").map(Number);
        return y === currentYear;
      }
      return true;
    });

    const csvContent = exportToCsv(filtered, accounts, categories, currency);
    const dateStr = new Date().toISOString().split("T")[0];
    downloadCsvFile(csvContent, `financeos_ledger_export_${dateStr}.csv`);

    playSound("success", soundEnabled);
    setCsvExportOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-md rounded-lg border border-[#232A3B] bg-[#0F131C] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#232A3B] px-4 py-3 bg-[#07090E]">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-[#00FF88]" />
            <h3 className="font-mono-num text-xs font-bold uppercase tracking-wider text-white">
              Export Ledger to CSV
            </h3>
          </div>
          <button
            onClick={() => setCsvExportOpen(false)}
            className="text-[#64748B] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
              Time Range
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as "all" | "this_month" | "this_year")}
              className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] font-mono-num"
            >
              <option value="this_month">Current Month Only</option>
              <option value="this_year">Current Year ({new Date().getFullYear()})</option>
              <option value="all">Full Historical Ledger</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
              Account Scope
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] font-mono-num"
            >
              <option value="all">All Accounts Combined</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
              Category Scope
            </label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] font-mono-num"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExport}
            className="flex w-full items-center justify-center gap-2 rounded border border-[#00FF88]/60 bg-[#00FF88]/15 py-2.5 text-xs font-bold font-mono-num text-[#00FF88] hover:bg-[#00FF88]/25 transition-colors shadow-[0_0_12px_rgba(0,255,136,0.15)]"
          >
            <Check className="h-4 w-4" />
            GENERATE &amp; DOWNLOAD CSV
          </button>
        </div>
      </div>
    </div>
  );
};
