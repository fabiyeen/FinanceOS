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

  const overlayRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isCsvExportOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playSound("click", soundEnabled);
        setCsvExportOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCsvExportOpen, setCsvExportOpen, soundEnabled]);

  if (!isCsvExportOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) {
      playSound("click", soundEnabled);
      setCsvExportOpen(false);
    }
  };

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
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-hidden pb-[env(safe-area-inset-bottom)]"
    >
      <div
        className="w-full max-w-md max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between border-b border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 px-5 py-4 bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-mono-num text-xs font-bold uppercase tracking-wider text-white dark:text-white light:text-slate-900">
                Export to CSV
              </h3>
              <p className="text-[11px] text-zinc-400">Download your transactions for spreadsheets</p>
            </div>
          </div>
          <button
            onClick={() => {
              playSound("click", soundEnabled);
              setCsvExportOpen(false);
            }}
            className="text-zinc-400 hover:text-white light:hover:text-slate-900 p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
              Time Range
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as "all" | "this_month" | "this_year")}
              className="w-full rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-slate-50 px-3.5 py-2.5 text-xs text-white dark:text-white light:text-slate-900 focus:outline-none focus:border-emerald-500/50 font-mono-num"
            >
              <option value="this_month">Current Month Only</option>
              <option value="this_year">Current Year ({new Date().getFullYear()})</option>
              <option value="all">All-time Transactions</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
              Account Scope
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-slate-50 px-3.5 py-2.5 text-xs text-white dark:text-white light:text-slate-900 focus:outline-none focus:border-emerald-500/50 font-mono-num"
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
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
              Category Scope
            </label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-slate-50 px-3.5 py-2.5 text-xs text-white dark:text-white light:text-slate-900 focus:outline-none focus:border-emerald-500/50 font-mono-num"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 px-5 py-4 bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-50/50">
          <button
            onClick={handleExport}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-2.5 text-xs font-mono-num shadow-sm transition-all"
          >
            <Check className="h-4 w-4" />
            Download CSV Export
          </button>
        </div>
      </div>
    </div>
  );
};
