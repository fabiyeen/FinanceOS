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

  if (!isCsvImportOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        className="w-full max-w-3xl rounded-lg border border-[#232A3B] bg-[#0F131C] shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#232A3B] px-4 py-3 bg-[#07090E]">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-[#FFB800]" />
            <h3 className="font-mono-num text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
              CSV Statement Import Wizard (Step {step} of 3)
            </h3>
          </div>
          <button
            onClick={() => {
              playSound("click", soundEnabled);
              setCsvImportOpen(false);
              setStep(1);
            }}
            className="text-[#64748B] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="p-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-[#00F0FF]/40 bg-[#00F0FF]/5 text-[#00F0FF]">
              <Upload className="h-8 w-8" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white uppercase font-mono-num">
                Drop your bank or credit card CSV statement
              </h4>
              <p className="text-xs text-[#94A3B8] font-mono-num mt-1">
                Auto-detects comma (,), semicolon (;), and tab delimiters
              </p>
            </div>

            <label className="inline-block cursor-pointer rounded border border-[#00F0FF]/60 bg-[#00F0FF]/15 px-4 py-2 text-xs font-bold font-mono-num text-[#00F0FF] hover:bg-[#00F0FF]/25 transition-colors">
              SELECT .CSV FILE
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
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono-num text-[#94A3B8]">
                Detected {rawRows.length} rows • Delimiter: [{detectedDelimiter === "\t" ? "TAB" : detectedDelimiter}]
              </span>
              <button
                onClick={() => setStep(1)}
                className="text-xs font-mono-num text-[#64748B] hover:text-white"
              >
                Choose Different File
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded bg-[#07090E] border border-[#232A3B]">
              <div>
                <label className="block text-[10px] font-mono-num uppercase text-[#00F0FF] mb-1">
                  * Date Column
                </label>
                <select
                  value={mapping.date}
                  onChange={(e) => setMapping({ ...mapping, date: e.target.value })}
                  className="w-full rounded border border-[#232A3B] bg-[#161B26] px-2 py-1 text-xs text-white focus:border-[#00F0FF] font-mono-num"
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
                <label className="block text-[10px] font-mono-num uppercase text-[#00F0FF] mb-1">
                  * Amount Column
                </label>
                <select
                  value={mapping.amount}
                  onChange={(e) => setMapping({ ...mapping, amount: e.target.value })}
                  className="w-full rounded border border-[#232A3B] bg-[#161B26] px-2 py-1 text-xs text-white focus:border-[#00F0FF] font-mono-num"
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
                <label className="block text-[10px] font-mono-num uppercase text-[#00F0FF] mb-1">
                  * Description Column
                </label>
                <select
                  value={mapping.desc}
                  onChange={(e) => setMapping({ ...mapping, desc: e.target.value })}
                  className="w-full rounded border border-[#232A3B] bg-[#161B26] px-2 py-1 text-xs text-white focus:border-[#00F0FF] font-mono-num"
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
                <label className="block text-[10px] font-mono-num uppercase text-[#94A3B8] mb-1">
                  Type Column (Optional)
                </label>
                <select
                  value={mapping.type || ""}
                  onChange={(e) => setMapping({ ...mapping, type: e.target.value })}
                  className="w-full rounded border border-[#232A3B] bg-[#161B26] px-2 py-1 text-xs text-white focus:border-[#00F0FF] font-mono-num"
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
              className="flex w-full items-center justify-center gap-2 rounded border border-[#00F0FF]/60 bg-[#00F0FF]/15 py-2.5 text-xs font-bold font-mono-num text-[#00F0FF] hover:bg-[#00F0FF]/25 transition-colors"
            >
              <span>PROCEED TO PREVIEW &amp; DEDUPLICATION</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Step 3: Validation & Deduplication Preview */}
        {step === 3 && (
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 text-xs font-mono-num">
                <span className="text-[#00FF88]">
                  Valid: {processedRows.filter((r) => r.isValid).length}
                </span>
                <span className="text-[#FF5C00]">
                  Duplicates: {processedRows.filter((r) => r.isDuplicate).length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="skipDupes"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded border-[#232A3B] bg-[#07090E] text-[#00F0FF] focus:ring-0"
                />
                <label htmlFor="skipDupes" className="text-xs font-mono-num text-[#94A3B8]">
                  Skip Duplicate Entries
                </label>
              </div>
            </div>

            {/* Preview Table */}
            <div className="max-h-64 overflow-y-auto rounded border border-[#232A3B] bg-[#07090E]">
              <table className="w-full text-left text-xs font-mono-num">
                <thead className="sticky top-0 bg-[#0F131C] border-b border-[#232A3B] text-[10px] text-[#64748B] uppercase">
                  <tr>
                    <th className="p-2">Date</th>
                    <th className="p-2">Description</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232A3B]/60">
                  {processedRows.slice(0, 50).map((row, i) => (
                    <tr
                      key={i}
                      className={`hover:bg-[#161B26] ${
                        row.isDuplicate ? "opacity-60 bg-[#FF5C00]/5" : ""
                      }`}
                    >
                      <td className="p-2 text-[#94A3B8]">{row.mapped.date}</td>
                      <td className="p-2 text-white truncate max-w-[180px]">
                        {row.mapped.desc}
                      </td>
                      <td className="p-2 text-right font-bold text-white">
                        {formatCurrency(row.mapped.amount || 0, currency, locale)}
                      </td>
                      <td className="p-2 uppercase text-[#64748B]">
                        {row.mapped.type}
                      </td>
                      <td className="p-2">
                        {row.isDuplicate ? (
                          <span className="rounded bg-[#FF5C00]/15 text-[#FF5C00] px-1.5 py-0.5 text-[9px]">
                            DUPLICATE
                          </span>
                        ) : row.isValid ? (
                          <span className="rounded bg-[#00FF88]/15 text-[#00FF88] px-1.5 py-0.5 text-[9px]">
                            READY
                          </span>
                        ) : (
                          <span className="rounded bg-[#FF0055]/15 text-[#FF0055] px-1.5 py-0.5 text-[9px]">
                            ERROR
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(2)}
                className="rounded border border-[#232A3B] bg-[#161B26] px-4 py-2 text-xs font-mono-num text-[#94A3B8] hover:text-white"
              >
                Back
              </button>
              <button
                onClick={handleCommitImport}
                disabled={isImporting}
                className="flex-1 flex items-center justify-center gap-2 rounded border border-[#00FF88]/60 bg-[#00FF88]/15 py-2.5 text-xs font-bold font-mono-num text-[#00FF88] hover:bg-[#00FF88]/25 transition-colors disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                <span>
                  {isImporting ? "BATCH IMPORTING..." : "COMMIT TO FINANCEOS LEDGER"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
