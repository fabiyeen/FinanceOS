"use client";

import React, { useEffect, useState } from "react";
import { X, Check, ArrowRightLeft, ArrowUpRight, ArrowDownLeft, Shield, Handshake } from "lucide-react";
import { useUIStore } from "../../store/useUIStore";
import { TransactionType } from "../../lib/types";
import { formatCurrency } from "../../lib/mathEngine";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { addTransactionWithLedgerSync } from "../../lib/db/syncEngine";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";

const TYPE_OPTIONS: { type: TransactionType; label: string; icon: React.ElementType; color: string }[] = [
  { type: "expense", label: "EXPENSE", icon: ArrowUpRight, color: "#FF5C00" },
  { type: "income", label: "INCOME", icon: ArrowDownLeft, color: "#00FF88" },
  { type: "transfer", label: "TRANSFER", icon: ArrowRightLeft, color: "#00F0FF" },
  { type: "vault_deposit", label: "VAULT DEP", icon: Shield, color: "#9D00FF" },
  { type: "vault_withdraw", label: "VAULT WDR", icon: Shield, color: "#00F0FF" },
  { type: "debt_payment", label: "DEBT PAY", icon: Handshake, color: "#FFB800" },
];

export const QuickTransactionModal: React.FC = () => {
  const { isQuickTxOpen, closeQuickTx, quickTxDraft, soundEnabled } = useUIStore();

  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray()) ?? [];
  const vaults = useLiveQuery(() => db.vaults.toArray()) ?? [];
  const debts = useLiveQuery(() => db.debts.where("status").equals("active").toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.get("main"));

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

  useEffect(() => {
    if (isQuickTxOpen) {
      const now = new Date();
      const defaultDate = now.toISOString().split("T")[0];
      const defaultTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      setType(quickTxDraft?.type || "expense");
      setAmountStr(quickTxDraft?.amount ? String(quickTxDraft.amount) : "");
      setDesc(quickTxDraft?.desc || "");
      setFromAccountId(quickTxDraft?.fromAccountId || accounts[0]?.id || "");
      setToAccountId(quickTxDraft?.toAccountId || accounts[1]?.id || "");
      setVaultId(quickTxDraft?.vaultId || vaults[0]?.id || "");
      setDebtId(quickTxDraft?.debtId || debts[0]?.id || "");
      setCategoryId(quickTxDraft?.categoryId || categories[0]?.id || "");
      setTags(quickTxDraft?.tags || []);
      setDate(quickTxDraft?.date || defaultDate);
      setTime(quickTxDraft?.time || defaultTime);
      setNote(quickTxDraft?.note || "");
      setError(null);
    }
  }, [isQuickTxOpen, quickTxDraft, accounts, vaults, debts, categories]);

  if (!isQuickTxOpen) return null;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Math.abs(parseFloat(amountStr));

    if (!parsedAmount || isNaN(parsedAmount)) {
      setError("Please enter a valid amount");
      playSound("alert", soundEnabled);
      return;
    }
    if (!desc.trim()) {
      setError("Please provide a description");
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div
        className="w-full max-w-lg rounded-lg border border-[#232A3B] bg-[#0F131C] shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#232A3B] px-4 py-3 bg-[#07090E]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#00F0FF]" />
            <h2 className="font-mono-num text-xs sm:text-sm font-bold tracking-wider text-white uppercase">
              New Ledger Transaction
            </h2>
          </div>
          <button
            onClick={() => {
              playSound("click", soundEnabled);
              closeQuickTx();
            }}
            className="rounded p-1 text-[#64748B] hover:bg-[#161B26] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Type Selector Tabs */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-1 rounded bg-[#07090E] border border-[#232A3B]">
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
                  }}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded text-[10px] font-mono-num transition-all ${
                    isSelected
                      ? "bg-[#1E2536] text-white border border-[#384259] shadow-sm"
                      : "text-[#64748B] hover:text-[#94A3B8]"
                  }`}
                  style={{ color: isSelected ? opt.color : undefined }}
                >
                  <Icon className="h-3.5 w-3.5 mb-1" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Amount Input & Quick Increment Chips */}
          <div>
            <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
              Amount ({currency})
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0"
                className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2.5 font-mono-num text-lg sm:text-xl font-bold text-white placeholder-[#475569] focus:border-[#00F0FF] focus:outline-none"
                required
              />
              {amountStr && (
                <span className="absolute right-3 top-3 text-xs font-mono-num text-[#94A3B8]">
                  {formatCurrency(parseFloat(amountStr) || 0, currency, locale)}
                </span>
              )}
            </div>

            {/* Quick chips */}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {[50000, 100000, 500000, 1000000].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleQuickAddAmount(chip)}
                  className="rounded border border-[#232A3B] bg-[#161B26] px-2 py-1 text-[11px] font-mono-num text-[#94A3B8] hover:border-[#00F0FF]/50 hover:text-white transition-colors"
                >
                  +{chip >= 1000000 ? `${chip / 1000000}M` : `${chip / 1000}k`}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
              Description / Merchant
            </label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="e.g. Cyberia Ramen Bar, Server Invoice"
              className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs sm:text-sm text-white placeholder-[#475569] focus:border-[#00F0FF] focus:outline-none"
              required
            />
          </div>

          {/* Source Account & Target Account/Vault/Debt depending on Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                {type === "income" ? "Destination Account" : "Source Account"}
              </label>
              <select
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.currentBalance, acc.currency, locale)})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Account if Transfer or Vault Withdraw */}
            {(type === "transfer" || type === "vault_withdraw") && (
              <div>
                <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                  Target Account
                </label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Vault Target if Vault Deposit or Withdraw */}
            {(type === "vault_deposit" || type === "vault_withdraw") && (
              <div>
                <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                  Target Vault
                </label>
                <select
                  value={vaultId}
                  onChange={(e) => setVaultId(e.target.value)}
                  className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                >
                  {vaults.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title} ({formatCurrency(v.currentAmount, currency, locale)} / {formatCurrency(v.targetAmount, currency, locale)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Debt Target if Debt Payment */}
            {type === "debt_payment" && (
              <div>
                <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                  Target Debt / IOU
                </label>
                <select
                  value={debtId}
                  onChange={(e) => setDebtId(e.target.value)}
                  className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                >
                  {debts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.counterparty} ({d.direction === "owe" ? "We Owe" : "Owed to Us"} - Remaining: {formatCurrency(d.amount - d.paidAmount, currency, locale)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Category */}
            <div>
              <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-1.5 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-1.5 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
              Tags
            </label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {tags.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1 rounded bg-[#1E2536] border border-[#232A3B] px-2 py-0.5 text-[11px] text-[#00F0FF] font-mono-num"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((tag) => tag !== t))}
                    className="hover:text-[#FF5C00]"
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
                className="flex-1 rounded border border-[#232A3B] bg-[#07090E] px-3 py-1.5 text-xs text-white placeholder-[#475569] focus:border-[#00F0FF] focus:outline-none font-mono-num"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="rounded border border-[#232A3B] bg-[#161B26] px-3 py-1.5 text-xs text-[#94A3B8] hover:text-white"
              >
                Add
              </button>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
              Internal Note / Reference
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional notes or receipt references..."
              className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white placeholder-[#475569] focus:border-[#00F0FF] focus:outline-none resize-none font-mono-num"
            />
          </div>

          {error && (
            <div className="rounded border border-[#FF5C00]/40 bg-[#FF5C00]/10 px-3 py-2 text-xs font-mono-num text-[#FF5C00]">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded border border-[#00F0FF]/60 bg-[#00F0FF]/15 py-2.5 text-xs sm:text-sm font-bold text-[#00F0FF] hover:bg-[#00F0FF]/25 transition-all font-mono-num shadow-[0_0_15px_rgba(0,240,255,0.2)]"
          >
            <Check className="h-4 w-4" />
            COMMIT ENTRY TO LEDGER
          </button>
        </form>
      </div>
    </div>
  );
};
