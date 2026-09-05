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

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCmdBarOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setInputVal("");
      setStatusMessage(null);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          playSound("click", soundEnabled);
          setCmdBarOpen(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isCmdBarOpen, setCmdBarOpen, soundEnabled]);

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

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) {
      handleClose();
    }
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
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 pt-12 sm:pt-20 animate-in fade-in duration-150 overflow-hidden"
    >
      <div
        className="w-full max-w-xl max-h-[calc(100dvh-4rem)] flex flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input Bar */}
        <div className="flex-shrink-0 flex items-center border-b border-[var(--border-default)] px-4 py-3 bg-[var(--bg-surface)]">
          <Command className="h-4 w-4 text-[var(--accent-primary)] mr-3 shrink-0" />
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
            placeholder="Type 'Spent 50k on Coffee BCA' or search actions..."
            className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
          />
          <kbd className="hidden sm:inline-block rounded-md border border-[var(--border-default)] bg-[var(--bg-canvas)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] font-mono">
            ESC
          </kbd>
        </div>

        {/* Live NLP Feedback Bar */}
        {parsed && parsed.amount && parsed.amount > 0 ? (
          <div className="border-b border-[var(--border-default)] bg-[var(--bg-canvas)] px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-[var(--accent-primary)] flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Parsed Transaction
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">
                Confidence: {Math.round(parsed.confidence * 100)}%
              </span>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-md bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 px-2 py-0.5 text-[var(--accent-primary)] font-semibold">
                {formatCurrency(parsed.amount, currency, locale)}
              </span>
              <span className="rounded-md bg-[var(--bg-surface)] border border-[var(--border-default)] px-2 py-0.5 text-[var(--text-primary)] uppercase text-[11px]">
                Type: {parsed.type}
              </span>
              {parsed.desc && (
                <span className="rounded-md bg-[var(--bg-surface)] border border-[var(--border-default)] px-2 py-0.5 text-[var(--text-secondary)] text-[11px]">
                  &quot;{parsed.desc}&quot;
                </span>
              )}
              {parsed.fromAccountId && (
                <span className="rounded-md bg-[var(--bg-surface)] border border-[var(--border-default)] px-2 py-0.5 text-[var(--color-emerald)] text-[11px]">
                  From: {accounts.find((a) => a.id === parsed.fromAccountId)?.name || parsed.fromAccountId}
                </span>
              )}
              {parsed.toAccountId && (
                <span className="rounded-md bg-[var(--bg-surface)] border border-[var(--border-default)] px-2 py-0.5 text-[var(--accent-primary)] text-[11px]">
                  To: {accounts.find((a) => a.id === parsed.toAccountId)?.name || parsed.toAccountId}
                </span>
              )}
            </div>

            <button
              onClick={handleExecute}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-primary)] py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Press Enter to Save</span>
            </button>
          </div>
        ) : null}

        {statusMessage && (
          <div className="px-4 py-2 text-xs text-[var(--color-emerald)] bg-[var(--color-emerald)]/10 border-b border-[var(--border-default)]">
            {statusMessage}
          </div>
        )}

        {/* Quick Commands List */}
        <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
          <div className="px-2 py-1 text-[10px] uppercase font-semibold tracking-wider text-[var(--text-muted)]">
            Quick Actions &amp; Navigation
          </div>

          <button
            onClick={() => {
              setCmdBarOpen(false);
              openQuickTx();
            }}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>New Transaction</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          </button>

          <button
            onClick={() => {
              setCmdBarOpen(false);
              setCsvImportOpen(true);
            }}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[var(--color-amber)]" />
              <span>Import CSV Statement</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          </button>

          <button
            onClick={() => {
              setCmdBarOpen(false);
              setCsvExportOpen(true);
            }}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-[var(--color-emerald)]" />
              <span>Export Transactions to CSV</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          </button>

          <button
            onClick={() => {
              togglePrivacyMode();
              setCmdBarOpen(false);
            }}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>Hide / Show Balances</span>
            </div>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">CTRL+H</span>
          </button>

          <button
            onClick={async () => {
              const executed = await processDueRecurringRules();
              setStatusMessage(`Executed ${executed} due recurring rules`);
              playSound("success", soundEnabled);
            }}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>Process Due Recurring Transactions</span>
            </div>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">AUTO</span>
          </button>

          <button
            onClick={() => {
              setCmdBarOpen(false);
              setLocked(true);
            }}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[var(--text-muted)]" />
              <span>Lock Screen</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border-default)] bg-[var(--bg-canvas)] px-4 py-2 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <span>Quick Actions</span>
          <span>Enter: Save • Esc: Close</span>
        </div>
      </div>
    </div>
  );
};
