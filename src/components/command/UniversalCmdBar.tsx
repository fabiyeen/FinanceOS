"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Command,
  Plus,
  FileSpreadsheet,
  Download,
  Shield,
  Lock,
  ArrowRight,
  Check,
  Zap,
} from "lucide-react";
import { useUIStore } from "../../store/useUIStore";
import { parseNaturalLanguageInput } from "../../lib/nlpParser";
import { formatCurrency } from "../../lib/mathEngine";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { addTransactionWithLedgerSync, processDueRecurringRules } from "../../lib/db/syncEngine";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";

export const UniversalCmdBar: React.FC = () => {
  const {
    isCmdBarOpen,
    setCmdBarOpen,
    openQuickTx,
    setCsvImportOpen,
    setCsvExportOpen,
    togglePrivacyMode,
    setLocked,
    soundEnabled,
  } = useUIStore();

  const [inputVal, setInputVal] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.get("main"));

  const currency = settings?.currency || "IDR";
  const locale = settings?.locale || "id-ID";

  useEffect(() => {
    if (isCmdBarOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setInputVal("");
      setStatusMessage(null);
    }
  }, [isCmdBarOpen]);

  // Live NLP parsing
  const parsed = useMemo(() => {
    if (!inputVal.trim()) return null;
    return parseNaturalLanguageInput(inputVal, accounts, categories);
  }, [inputVal, accounts, categories]);

  if (!isCmdBarOpen) return null;

  const handleClose = () => {
    playSound("click", soundEnabled);
    setCmdBarOpen(false);
  };

  const handleExecute = async () => {
    if (!parsed || !parsed.amount || parsed.amount <= 0) return;

    playSound("click", soundEnabled);
    triggerHaptic(25);

    const today = new Date().toISOString().split("T")[0];
    const hours = String(new Date().getHours()).padStart(2, "0");
    const minutes = String(new Date().getMinutes()).padStart(2, "0");

    const defaultAccId = accounts[0]?.id || "acc_bca";
    const defaultCatId = categories[0]?.id || "cat_food";

    const res = await addTransactionWithLedgerSync({
      desc: parsed.desc || "Quick Entry",
      amount: parsed.amount,
      type: parsed.type,
      fromAccountId: parsed.fromAccountId || defaultAccId,
      toAccountId: parsed.toAccountId,
      categoryId: parsed.categoryId || defaultCatId,
      tags: ["CmdBarEntry"],
      date: today,
      time: `${hours}:${minutes}`,
      source: "web_client",
    });

    if (res.error) {
      setStatusMessage(`Error: ${res.error}`);
      playSound("alert", soundEnabled);
    } else {
      playSound("success", soundEnabled);
      setStatusMessage("Logged to ledger successfully!");
      setTimeout(() => {
        setCmdBarOpen(false);
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 pt-16 sm:pt-24 animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl rounded-lg border border-[#232A3B] bg-[#0F131C] shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input Bar */}
        <div className="flex items-center border-b border-[#232A3B] px-3.5 py-3 bg-[#07090E]">
          <Command className="h-4 w-4 text-[#00F0FF] mr-2.5 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleExecute();
              } else if (e.key === "Escape") {
                handleClose();
              }
            }}
            placeholder="Natural language: 'Spent 50k on Ramen BCA' or command..."
            className="w-full bg-transparent text-sm text-white placeholder-[#64748B] focus:outline-none font-mono-num"
          />
          <kbd className="hidden sm:inline-block rounded border border-[#232A3B] bg-[#161B26] px-1.5 py-0.5 text-[10px] text-[#64748B] font-mono-num">
            ESC
          </kbd>
        </div>

        {/* Live NLP Feedback Bar */}
        {parsed && parsed.amount && parsed.amount > 0 ? (
          <div className="border-b border-[#232A3B] bg-[#161B26]/60 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono-num uppercase tracking-wider text-[#00F0FF] flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Parsed Transaction
              </span>
              <span className="text-[10px] font-mono-num text-[#64748B]">
                CONFIDENCE: {Math.round(parsed.confidence * 100)}%
              </span>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-mono-num">
              <span className="rounded bg-[#00F0FF]/15 border border-[#00F0FF]/40 px-2 py-0.5 text-[#00F0FF] font-bold">
                {formatCurrency(parsed.amount, currency, locale)}
              </span>
              <span className="rounded bg-[#1E2536] border border-[#232A3B] px-2 py-0.5 text-white uppercase">
                TYPE: {parsed.type}
              </span>
              {parsed.desc && (
                <span className="rounded bg-[#1E2536] border border-[#232A3B] px-2 py-0.5 text-[#94A3B8]">
                  &quot;{parsed.desc}&quot;
                </span>
              )}
              {parsed.fromAccountId && (
                <span className="rounded bg-[#1E2536] border border-[#232A3B] px-2 py-0.5 text-[#00FF88]">
                  FROM: {accounts.find((a) => a.id === parsed.fromAccountId)?.name || parsed.fromAccountId}
                </span>
              )}
              {parsed.toAccountId && (
                <span className="rounded bg-[#1E2536] border border-[#232A3B] px-2 py-0.5 text-[#00F0FF]">
                  TO: {accounts.find((a) => a.id === parsed.toAccountId)?.name || parsed.toAccountId}
                </span>
              )}
            </div>

            <button
              onClick={handleExecute}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded border border-[#00FF88]/50 bg-[#00FF88]/15 py-1.5 text-xs font-bold text-[#00FF88] hover:bg-[#00FF88]/25 transition-all font-mono-num"
            >
              <Check className="h-3.5 w-3.5" />
              PRESS ENTER TO COMMIT TO LEDGER
            </button>
          </div>
        ) : null}

        {statusMessage && (
          <div className="px-4 py-2 text-xs font-mono-num text-[#00FF88] bg-[#00FF88]/10 border-b border-[#232A3B]">
            {statusMessage}
          </div>
        )}

        {/* Quick Commands List */}
        <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
          <div className="px-2 py-1 text-[10px] font-mono-num uppercase tracking-wider text-[#64748B]">
            System Actions &amp; Navigation
          </div>

          <button
            onClick={() => {
              setCmdBarOpen(false);
              openQuickTx();
            }}
            className="flex w-full items-center justify-between rounded px-2.5 py-2 text-xs text-[#F1F5F9] hover:bg-[#161B26] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-[#00F0FF]" />
              <span>Open Detailed Transaction Modal</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-[#64748B]" />
          </button>

          <button
            onClick={() => {
              setCmdBarOpen(false);
              setCsvImportOpen(true);
            }}
            className="flex w-full items-center justify-between rounded px-2.5 py-2 text-xs text-[#F1F5F9] hover:bg-[#161B26] transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[#FFB800]" />
              <span>Import CSV Bank Statement</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-[#64748B]" />
          </button>

          <button
            onClick={() => {
              setCmdBarOpen(false);
              setCsvExportOpen(true);
            }}
            className="flex w-full items-center justify-between rounded px-2.5 py-2 text-xs text-[#F1F5F9] hover:bg-[#161B26] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-[#00FF88]" />
              <span>Export Ledger to CSV</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-[#64748B]" />
          </button>

          <button
            onClick={() => {
              togglePrivacyMode();
              setCmdBarOpen(false);
            }}
            className="flex w-full items-center justify-between rounded px-2.5 py-2 text-xs text-[#F1F5F9] hover:bg-[#161B26] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#FF5C00]" />
              <span>Toggle Privacy Blinder Mode</span>
            </div>
            <span className="text-[10px] font-mono-num text-[#64748B]">CTRL+H</span>
          </button>

          <button
            onClick={async () => {
              const executed = await processDueRecurringRules();
              setStatusMessage(`Executed ${executed} due recurring rules`);
              playSound("success", soundEnabled);
            }}
            className="flex w-full items-center justify-between rounded px-2.5 py-2 text-xs text-[#F1F5F9] hover:bg-[#161B26] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#9D00FF]" />
              <span>Trigger Due Recurring Subscriptions</span>
            </div>
            <span className="text-[10px] font-mono-num text-[#64748B]">AUTO-SYNC</span>
          </button>

          <button
            onClick={() => {
              setCmdBarOpen(false);
              setLocked(true);
            }}
            className="flex w-full items-center justify-between rounded px-2.5 py-2 text-xs text-[#F1F5F9] hover:bg-[#161B26] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#64748B]" />
              <span>Lock App Session (WebAuthn / PIN)</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-[#64748B]" />
          </button>
        </div>

        {/* Footer */}
        <div className="border-t border-[#232A3B] bg-[#07090E] px-3.5 py-2 flex items-center justify-between text-[10px] text-[#64748B] font-mono-num">
          <span>Neo-Tokyo Ledger Dispatch</span>
          <span>ENTER: COMMIT • ESC: DISMISS</span>
        </div>
      </div>
    </div>
  );
};
