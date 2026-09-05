"use client";

import React, { useState } from "react";
import {
  Upload,
  X,
  Check,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  RefreshCw,
  Copy,
} from "lucide-react";
import { useUIStore } from "../../store/useUIStore";
import {
  CsvMapping,
  guessCsvMapping,
  parseCsvRaw,
  ParsedCsvRow,
  processCsvRows,
} from "../../lib/csvEngine";
import { formatCurrency } from "../../lib/mathEngine";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { addTransactionWithLedgerSync } from "../../lib/db/syncEngine";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";

export const CsvImportWizard: React.FC = () => {
  const { isCsvImportOpen, setCsvImportOpen, soundEnabled } = useUIStore();

  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray()) ?? [];
  const existingTransactions = useLiveQuery(() => db.transactions.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.get("main"));

  const currency = settings?.currency || "IDR";
  const locale = settings?.locale || "id-ID";

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [detectedDelimiter, setDetectedDelimiter] = useState(",");
  const [mapping, setMapping] = useState<CsvMapping>({ date: "", desc: "", amount: "" });
  const [processedRows, setProcessedRows] = useState<ParsedCsvRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const overlayRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isCsvImportOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playSound("click", soundEnabled);
        setCsvImportOpen(false);
        setStep(1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCsvImportOpen, setCsvImportOpen, soundEnabled]);

  if (!isCsvImportOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) {
      playSound("click", soundEnabled);
      setCsvImportOpen(false);
      setStep(1);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    playSound("click", soundEnabled);
    triggerHaptic(15);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const { headers, rows, delimiter } = parseCsvRaw(text);
      setCsvHeaders(headers);
      setRawRows(rows);
      setDetectedDelimiter(delimiter);

      const guessed = guessCsvMapping(headers);
      setMapping(guessed);
      setStep(2);
    };
    reader.readAsText(file);
  };

  const handleProceedToValidation = () => {
    if (!mapping.date || !mapping.desc || !mapping.amount) {
      playSound("alert", soundEnabled);
      alert("Please map at least Date, Description, and Amount columns");
      return;
    }

    playSound("tab", soundEnabled);
    const defaultAccId = accounts[0]?.id || "acc_bca";
    const processed = processCsvRows(
      rawRows,
      mapping,
      existingTransactions,
      accounts,
      categories,
      defaultAccId
    );
    setProcessedRows(processed);
    setStep(3);
  };

  const handleCommitImport = async () => {
    setIsImporting(true);
    playSound("click", soundEnabled);
    triggerHaptic(30);

    const rowsToImport = processedRows.filter((r) => {
      if (!r.isValid) return false;
      if (skipDuplicates && r.isDuplicate) return false;
      return true;
    });

    let successCount = 0;
    for (const r of rowsToImport) {
      if (r.mapped.amount && r.mapped.desc && r.mapped.date && r.mapped.fromAccountId) {
        await addTransactionWithLedgerSync({
          desc: r.mapped.desc,
          amount: r.mapped.amount,
          type: r.mapped.type || "expense",
          fromAccountId: r.mapped.fromAccountId,
          toAccountId: r.mapped.toAccountId,
          categoryId: r.mapped.categoryId || categories[0]?.id || "cat_food",
          tags: [...(r.mapped.tags || []), "CsvImport"],
          date: r.mapped.date,
          time: r.mapped.time || "12:00",
          note: r.mapped.note,
          source: "csv_import",
        });
        successCount++;
      }
    }

    setIsImporting(false);
    playSound("success", soundEnabled);
    alert(`Successfully imported ${successCount} transactions into FinanceOS ledger!`);
    setCsvImportOpen(false);
    setStep(1);
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 overflow-hidden pb-[env(safe-area-inset-bottom)]"
    >
      <div
        className="w-full max-w-3xl max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="flex-shrink-0 flex items-center justify-between border-b border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 px-5 py-4 bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-mono-num text-xs sm:text-sm font-bold uppercase tracking-wider text-white dark:text-white light:text-slate-900">
                Import CSV Statement (Step {step} of 3)
              </h3>
              <p className="text-[11px] text-zinc-400">Import bank or credit card statements into your ledger</p>
            </div>
          </div>
          <button
            onClick={() => {
              playSound("click", soundEnabled);
              setCsvImportOpen(false);
              setStep(1);
            }}
            className="text-zinc-400 hover:text-white light:hover:text-slate-900 p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Wizard Body */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="p-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-emerald-500/30 bg-emerald-500/5 text-emerald-400">
              <Upload className="h-7 w-7" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white dark:text-white light:text-slate-900">
                Choose your CSV statement file
              </h4>
              <p className="text-xs text-zinc-400 mt-1">
                Auto-detects comma (,), semicolon (;), and tab delimiters
              </p>
            </div>

            <label className="inline-block cursor-pointer rounded-xl bg-white/[0.06] hover:bg-white/[0.1] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] light:bg-slate-100 light:hover:bg-slate-200 text-white dark:text-white light:text-slate-800 border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 px-5 py-2.5 text-xs font-semibold font-mono-num transition-all">
              Select CSV File
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 2 && (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono-num text-zinc-400">
                Detected {rawRows.length} rows • Delimiter: [{detectedDelimiter === "\t" ? "TAB" : detectedDelimiter}]
              </span>
              <button
                onClick={() => setStep(1)}
                className="text-xs font-mono-num text-zinc-400 hover:text-white light:hover:text-slate-900"
              >
                Choose Different File
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-xl bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-50/50 border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200">
              <div>
                <label className="block text-[11px] font-medium text-emerald-400 mb-1.5">
                  * Date Column
                </label>
                <select
                  value={mapping.date}
                  onChange={(e) => setMapping({ ...mapping, date: e.target.value })}
                  className="w-full rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-white px-3 py-2 text-xs text-white dark:text-white light:text-slate-900 focus:outline-none focus:border-emerald-500/50 font-mono-num"
                >
                  <option value="">-- Select Header --</option>
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-emerald-400 mb-1.5">
                  * Amount Column
                </label>
                <select
                  value={mapping.amount}
                  onChange={(e) => setMapping({ ...mapping, amount: e.target.value })}
                  className="w-full rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-white px-3 py-2 text-xs text-white dark:text-white light:text-slate-900 focus:outline-none focus:border-emerald-500/50 font-mono-num"
                >
                  <option value="">-- Select Header --</option>
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-emerald-400 mb-1.5">
                  * Description Column
                </label>
                <select
                  value={mapping.desc}
                  onChange={(e) => setMapping({ ...mapping, desc: e.target.value })}
                  className="w-full rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-white px-3 py-2 text-xs text-white dark:text-white light:text-slate-900 focus:outline-none focus:border-emerald-500/50 font-mono-num"
                >
                  <option value="">-- Select Header --</option>
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
                  Type Column (Optional)
                </label>
                <select
                  value={mapping.type || ""}
                  onChange={(e) => setMapping({ ...mapping, type: e.target.value })}
                  className="w-full rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-white px-3 py-2 text-xs text-white dark:text-white light:text-slate-900 focus:outline-none focus:border-emerald-500/50 font-mono-num"
                >
                  <option value="">-- None (Default: Expense) --</option>
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleProceedToValidation}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-2.5 text-xs font-mono-num shadow-sm transition-all"
            >
              <span>Proceed to Preview</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Step 3: Validation & Deduplication Preview */}
        {step === 3 && (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 text-xs font-mono-num">
                <span className="text-emerald-400 font-medium">
                  Valid: {processedRows.filter((r) => r.isValid).length}
                </span>
                <span className="text-amber-400 font-medium">
                  Duplicates: {processedRows.filter((r) => r.isDuplicate).length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="skipDupes"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded border-white/20 bg-white/[0.05] text-emerald-500 focus:ring-0"
                />
                <label htmlFor="skipDupes" className="text-xs font-mono-num text-zinc-400">
                  Skip Duplicate Entries
                </label>
              </div>
            </div>

            {/* Preview Table */}
            <div className="max-h-64 overflow-y-auto rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-50/30">
              <table className="w-full text-left text-xs font-mono-num">
                <thead className="sticky top-0 bg-[var(--bg-surface)] border-b border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 text-[10px] text-zinc-400 uppercase">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5 text-right">Amount</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05] dark:divide-white/[0.05] light:divide-slate-200">
                  {processedRows.slice(0, 50).map((row, i) => (
                    <tr
                      key={i}
                      className={`hover:bg-white/[0.02] dark:hover:bg-white/[0.02] light:hover:bg-slate-100/50 ${
                        row.isDuplicate ? "opacity-60 bg-amber-500/5" : ""
                      }`}
                    >
                      <td className="p-2.5 text-zinc-400">{row.mapped.date}</td>
                      <td className="p-2.5 text-white dark:text-white light:text-slate-900 truncate max-w-[180px]">
                        {row.mapped.desc}
                      </td>
                      <td className="p-2.5 text-right font-medium text-white dark:text-white light:text-slate-900">
                        {formatCurrency(row.mapped.amount || 0, currency, locale)}
                      </td>
                      <td className="p-2.5 uppercase text-zinc-400">
                        {row.mapped.type}
                      </td>
                      <td className="p-2.5">
                        {row.isDuplicate ? (
                          <span className="rounded-full bg-amber-500/10 text-amber-400 px-2 py-0.5 text-[10px] font-medium border border-amber-500/20">
                            Duplicate
                          </span>
                        ) : row.isValid ? (
                          <span className="rounded-full bg-emerald-500/10 text-emerald-400 px-2 py-0.5 text-[10px] font-medium border border-emerald-500/20">
                            Ready
                          </span>
                        ) : (
                          <span className="rounded-full bg-rose-500/10 text-rose-400 px-2 py-0.5 text-[10px] font-medium border border-rose-500/20">
                            Error
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setStep(2)}
                className="rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] hover:bg-white/[0.06] dark:bg-white/[0.03] light:bg-slate-100 px-4 py-2.5 text-xs font-medium text-zinc-300 dark:text-zinc-300 light:text-slate-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCommitImport}
                disabled={isImporting}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-2.5 text-xs font-mono-num shadow-sm transition-all disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                <span>
                  {isImporting ? "Importing..." : "Add to Transactions"}
                </span>
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
