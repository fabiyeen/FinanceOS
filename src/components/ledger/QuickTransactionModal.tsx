"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Check,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Shield,
  Handshake,
  Settings2,
} from "lucide-react";
import { useUIStore } from "../../store/useUIStore";
import { TransactionType } from "../../lib/types";
import { formatCurrency } from "../../lib/mathEngine";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { addTransactionWithLedgerSync } from "../../lib/db/syncEngine";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";

const TYPE_OPTIONS: { type: TransactionType; label: string; icon: React.ElementType; color: string }[] = [
  { type: "expense", label: "Expense", icon: ArrowUpRight, color: "#F43F5E" },
  { type: "income", label: "Income", icon: ArrowDownLeft, color: "#10B981" },
  { type: "transfer", label: "Transfer", icon: ArrowRightLeft, color: "#3B82F6" },
  { type: "vault_deposit", label: "Deposit", icon: Shield, color: "#8B5CF6" },
  { type: "vault_withdraw", label: "Withdraw", icon: Shield, color: "#06B6D4" },
  { type: "debt_payment", label: "Debt Pay", icon: Handshake, color: "#F59E0B" },
];

export const QuickTransactionModal: React.FC = () => {
  const {
    isQuickTxOpen,
    closeQuickTx,
    quickTxDraft,
    soundEnabled,
    setCategoryManagerOpen,
  } = useUIStore();

  const overlayRef = useRef<HTMLDivElement>(null);

  const rawAccounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const rawCategories = useLiveQuery(() => db.categories.toArray()) ?? [];
  const vaults = useLiveQuery(() => db.vaults.toArray()) ?? [];
  const debts = useLiveQuery(() => db.debts.where("status").equals("active").toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.get("main"));

  // Sort by priority order
  const accounts = [...rawAccounts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const categories = [...rawCategories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const currency = settings?.currency || "IDR";
  const locale = settings?.locale || "id-ID";

  const [type, setType] = useState<TransactionType>("expense");
  const [amountStr, setAmountStr] = useState("");
  const [desc, setDesc] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [vaultId, setVaultId] = useState("");
  const [debtId, setDebtId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Universal dismissal via Escape key
  useEffect(() => {
    if (!isQuickTxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playSound("click", soundEnabled);
        closeQuickTx();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isQuickTxOpen, closeQuickTx, soundEnabled]);

  const prevOpenRef = useRef(false);

  // Sync draft or defaults only when modal transitions from closed to open or quickTxDraft updates
  useEffect(() => {
    if (isQuickTxOpen && !prevOpenRef.current) {
      const now = new Date();
      const defaultDate = now.toISOString().split("T")[0];
      const defaultTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const initialType = quickTxDraft?.type || "expense";
      setType(initialType);
      setAmountStr(quickTxDraft?.amount ? String(quickTxDraft.amount) : "");
      setDesc(quickTxDraft?.desc || "");
      setFromAccountId(
        quickTxDraft?.fromAccountId ||
        accounts.find((a) => a.id === "acc_bca")?.id ||
        accounts[0]?.id ||
        ""
      );
      setToAccountId(
        quickTxDraft?.toAccountId ||
        accounts.find((a) => a.id !== fromAccountId)?.id ||
        accounts[1]?.id ||
        ""
      );
      setVaultId(quickTxDraft?.vaultId || vaults[0]?.id || "");
      setDebtId(quickTxDraft?.debtId || debts[0]?.id || "");

      // Match category type if possible
      const matchingCats = categories.filter((c) =>
        initialType === "income" ? c.type === "income" : c.type === "expense"
      );
      setCategoryId(quickTxDraft?.categoryId || matchingCats[0]?.id || categories[0]?.id || "");

      setTags(quickTxDraft?.tags || []);
      setDate(quickTxDraft?.date || defaultDate);
      setTime(quickTxDraft?.time || defaultTime);
      setNote(quickTxDraft?.note || "");
      setError(null);
    }
    prevOpenRef.current = isQuickTxOpen;
  }, [isQuickTxOpen, quickTxDraft]);

  // Fallback initial account selection if accounts query loaded after modal open
  useEffect(() => {
    if (isQuickTxOpen && !fromAccountId && accounts.length > 0) {
      setFromAccountId(accounts.find((a) => a.id === "acc_bca")?.id || accounts[0].id);
      if (accounts.length > 1 && !toAccountId) {
        setToAccountId(accounts.find((a) => a.id !== accounts[0].id)?.id || accounts[1].id);
      }
    }
  }, [isQuickTxOpen, fromAccountId, toAccountId, accounts]);

  if (!isQuickTxOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) {
      playSound("click", soundEnabled);
      closeQuickTx();
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleQuickAddAmount = (add: number) => {
    playSound("click", soundEnabled);
    triggerHaptic(10);
    const curr = parseFloat(amountStr) || 0;
    setAmountStr(String(curr + add));
  };

  const selectedVault = vaults.find((v) => v.id === vaultId);
  const selectedSourceAccount = accounts.find((a) => a.id === fromAccountId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Math.abs(parseFloat(amountStr));

    if (!parsedAmount || isNaN(parsedAmount)) {
      setError("Please enter a valid monetary amount");
      playSound("alert", soundEnabled);
      return;
    }
    if (!desc.trim()) {
      setError("Please provide a description or merchant");
      playSound("alert", soundEnabled);
      return;
    }
    if (!fromAccountId) {
      setError("Source account is required");
      playSound("alert", soundEnabled);
      return;
    }
    if (type === "transfer" && fromAccountId === toAccountId) {
      setError("Source and destination account cannot be identical");
      playSound("alert", soundEnabled);
      return;
    }
    if (type === "vault_withdraw" && selectedVault && parsedAmount > selectedVault.currentAmount) {
      setError(`Cannot withdraw more than current vault balance (${formatCurrency(selectedVault.currentAmount, currency, locale)})`);
      playSound("alert", soundEnabled);
      return;
    }

    const res = await addTransactionWithLedgerSync({
      desc: desc.trim(),
      amount: parsedAmount,
      type,
      fromAccountId,
      toAccountId: type === "transfer" || type === "vault_withdraw" ? toAccountId : undefined,
      vaultId: type === "vault_deposit" || type === "vault_withdraw" ? vaultId : undefined,
      debtId: type === "debt_payment" ? debtId : undefined,
      categoryId: categoryId || categories[0]?.id || "cat_general",
      tags,
      date: date || new Date().toISOString().split("T")[0],
      time: time || "12:00",
      note: note.trim() || undefined,
      source: "web_client",
    });

    if (res.error) {
      setError(res.error);
      playSound("alert", soundEnabled);
    } else {
      playSound("success", soundEnabled);
      triggerHaptic(30);
      closeQuickTx();
    }
  };

  // Filter categories to match active type
  const relevantCategories = categories.filter((c) =>
    type === "income" ? c.type === "income" : c.type === "expense"
  );

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-black/70 backdrop-blur-sm overflow-hidden"
    >
      <div
        className="relative z-10 pointer-events-auto w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[calc(100dvh-2rem)] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[var(--border-subtle)] bg-[var(--card-bg)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="flex-shrink-0 flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3 bg-[var(--card-surface)]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
              New Transaction
            </h2>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)] capitalize">
              {type.replace("_", " ")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              playSound("click", soundEnabled);
              closeQuickTx();
            }}
            className="rounded-lg p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 pr-2 custom-scrollbar">
            {/* Type Selector Tabs */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 p-1 rounded-xl bg-[var(--bg-void)] border border-[var(--border-subtle)]">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = type === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => {
                      playSound("tab", soundEnabled);
                      setType(opt.type);
                      // Auto switch category for income vs expense
                      if (opt.type === "income") {
                        const firstInc = categories.find((c) => c.type === "income");
                        if (firstInc) setCategoryId(firstInc.id);
                      } else if (opt.type === "expense") {
                        const firstExp = categories.find((c) => c.type === "expense");
                        if (firstExp) setCategoryId(firstExp.id);
                      }
                    }}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[11px] font-medium transition-all min-h-[44px] ${
                      isSelected
                        ? "bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border-industrial)] shadow-sm font-semibold"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}
                    style={{ color: isSelected ? opt.color : undefined }}
                  >
                    <Icon className="h-4 w-4 mb-1" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Amount Input & Quick Chips */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Amount ({currency})
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3.5 py-2.5 font-mono-num text-xl font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-emerald-500 focus:outline-none min-h-[44px]"
                  required
                  autoFocus
                />
                {amountStr && (
                  <span className="absolute right-3.5 top-3 text-xs font-mono-num text-[var(--text-muted)]">
                    {formatCurrency(parseFloat(amountStr) || 0, currency, locale)}
                  </span>
                )}
              </div>

              {/* Quick Increment Chips */}
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {[50000, 100000, 500000, 1000000].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleQuickAddAmount(chip)}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--card-surface)] px-2.5 py-1 text-xs font-mono-num text-[var(--text-secondary)] hover:border-emerald-500/50 hover:text-[var(--text-primary)] transition-colors min-h-[36px]"
                  >
                    +{chip >= 1000000 ? `${chip / 1000000}M` : `${chip / 1000}k`}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Description
              </label>
              <input
                type="text"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="e.g. Coffee, Groceries, Dinner with friends"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-emerald-500 focus:outline-none min-h-[44px]"
                required
              />
            </div>

            {/* Accounts Routing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  {type === "income" ? "Destination Account" : "Payment Account"}
                </label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-emerald-500 focus:outline-none min-h-[44px]"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatCurrency(acc.currentBalance, acc.currency, locale)})
                    </option>
                  ))}
                </select>
                {selectedSourceAccount && type !== "income" && (
                  <span className="block text-[11px] text-[var(--text-muted)] mt-1">
                    Available: {formatCurrency(selectedSourceAccount.currentBalance, currency, locale)}
                  </span>
                )}
              </div>

              {/* Target Account if Transfer or Vault Withdraw */}
              {(type === "transfer" || type === "vault_withdraw") && (
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Destination Account
                  </label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-emerald-500 focus:outline-none min-h-[44px]"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatCurrency(acc.currentBalance, acc.currency, locale)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Vault Target if Vault Deposit / Withdraw */}
              {(type === "vault_deposit" || type === "vault_withdraw") && (
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Savings Goal
                  </label>
                  <select
                    value={vaultId}
                    onChange={(e) => setVaultId(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-emerald-500 focus:outline-none min-h-[44px]"
                  >
                    {vaults.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title} ({formatCurrency(v.currentAmount, currency, locale)})
                      </option>
                    ))}
                  </select>
                  {selectedVault && (
                    <span className="block text-[11px] text-purple-500 mt-1">
                      Current: {formatCurrency(selectedVault.currentAmount, currency, locale)} / Target: {formatCurrency(selectedVault.targetAmount, currency, locale)}
                    </span>
                  )}
                </div>
              )}

              {/* Debt Target if Debt Payment */}
              {type === "debt_payment" && (
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    IOU / Debt Record
                  </label>
                  <select
                    value={debtId}
                    onChange={(e) => setDebtId(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-emerald-500 focus:outline-none min-h-[44px]"
                  >
                    {debts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.counterparty} ({formatCurrency(d.amount - d.paidAmount, currency, locale)} remaining)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Category Selector with Manage Action */}
            {(type === "expense" || type === "income") && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    Category
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      playSound("click", soundEnabled);
                      setCategoryManagerOpen(true);
                    }}
                    className="text-[11px] text-emerald-500 hover:text-emerald-400 flex items-center gap-1 font-medium transition-colors"
                  >
                    <Settings2 className="h-3 w-3" />
                    <span>Manage</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)]">
                  {relevantCategories.map((cat) => {
                    const isSelected = categoryId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          playSound("tab", soundEnabled);
                          setCategoryId(cat.id);
                        }}
                        className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium transition-all text-left min-h-[40px] ${
                          isSelected
                            ? "bg-[var(--card-bg)] text-[var(--text-primary)] border border-emerald-500/50 shadow-sm"
                            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)]"
                        }`}
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-emerald-500 focus:outline-none min-h-[44px]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-emerald-500 focus:outline-none min-h-[44px]"
                  required
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Tags
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((tag) => tag !== t))}
                      className="hover:text-rose-500 ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Add tag and press Enter"
                  className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-emerald-500 focus:outline-none min-h-[40px]"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3.5 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] transition-colors min-h-[40px]"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional notes or receipt references..."
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-emerald-500 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex-shrink-0 border-t border-[var(--border-subtle)] px-4 py-3 bg-[var(--card-surface)] space-y-2">
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-500">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  playSound("click", soundEnabled);
                  closeQuickTx();
                }}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] px-4 py-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] transition-colors min-h-[44px]"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-2.5 text-sm font-semibold hover:opacity-90 transition-all shadow-sm min-h-[44px]"
              >
                <Check className="h-4 w-4" />
                <span>Add Transaction</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
