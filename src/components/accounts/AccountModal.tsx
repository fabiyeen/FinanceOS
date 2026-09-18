"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Check,
  Wallet,
  Landmark,
  Building2,
  CreditCard,
  Smartphone,
  Banknote,
  TrendingUp,
  Coins,
  Shield,
  AlertTriangle,
  ArrowRightLeft,
} from "lucide-react";
import { Account, AccountType } from "../../lib/types";
import { formatCurrency, safeSub } from "../../lib/mathEngine";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { db } from "../../lib/db/dexie";
import { useAuth } from "../../lib/auth/authContext";
import { addTransactionWithLedgerSync, saveAccount, deleteAccount } from "../../lib/db/syncEngine";

export const ACCOUNT_ICONS: Record<string, React.ElementType> = {
  Landmark,
  Building2,
  CreditCard,
  Smartphone,
  Banknote,
  TrendingUp,
  Coins,
  Shield,
  Wallet,
};

export const ACCOUNT_COLORS = [
  "#00F0FF", // Cyan
  "#00FF88", // Emerald
  "#FF5C00", // Neon Flame
  "#FFB800", // Amber
  "#9D00FF", // Violet
  "#38BDF8", // Sky
  "#94A3B8", // Slate
  "#E056FD", // Neon Pink
];

interface AccountModalProps {
  isOpen: boolean;
  accountToEdit: Account | null;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  accountToEdit,
  onClose,
}) => {
  const { user } = useAuth();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [currency, setCurrency] = useState("IDR");
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [initialBalanceDisplay, setInitialBalanceDisplay] = useState("");
  const [currentBalanceInput, setCurrentBalanceInput] = useState<number>(0);
  const [currentBalanceDisplay, setCurrentBalanceDisplay] = useState("");
  const [creditLimit, setCreditLimit] = useState<number>(0);
  const [creditLimitDisplay, setCreditLimitDisplay] = useState("");
  const [statementDay, setStatementDay] = useState("20");
  const [color, setColor] = useState("#00F0FF");
  const [icon, setIcon] = useState("Landmark");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Archive / Delete confirm states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Universal Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playSound("click", true);
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Sync state on open/edit
  useEffect(() => {
    if (isOpen) {
      if (accountToEdit) {
        setName(accountToEdit.name);
        setType(accountToEdit.type);
        setCurrency(accountToEdit.currency || "IDR");
        const initBal = accountToEdit.initialBalance || 0;
        setInitialBalance(initBal);
        setInitialBalanceDisplay(initBal > 0 ? initBal.toLocaleString("id-ID") : "");
        const currBal = accountToEdit.currentBalance || 0;
        setCurrentBalanceInput(currBal);
        setCurrentBalanceDisplay(currBal !== 0 ? currBal.toLocaleString("id-ID") : "0");
        const cLim = accountToEdit.creditLimit || 0;
        setCreditLimit(cLim);
        setCreditLimitDisplay(cLim > 0 ? cLim.toLocaleString("id-ID") : "");
        setStatementDay(accountToEdit.statementClosingDay ? String(accountToEdit.statementClosingDay) : "20");
        setColor(accountToEdit.color || "#00F0FF");
        setIcon(accountToEdit.icon || "Landmark");
      } else {
        setName("");
        setType("checking");
        setCurrency("IDR");
        setInitialBalance(0);
        setInitialBalanceDisplay("");
        setCurrentBalanceInput(0);
        setCurrentBalanceDisplay("");
        setCreditLimit(0);
        setCreditLimitDisplay("");
        setStatementDay("20");
        setColor("#00F0FF");
        setIcon("Landmark");
      }
      setError(null);
      setShowDeleteConfirm(false);
    }
  }, [isOpen, accountToEdit]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) {
      playSound("click", true);
      onClose();
    }
  };

  const handleInitialBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanDigits = e.target.value.replace(/\D/g, "");
    if (!cleanDigits) {
      setInitialBalance(0);
      setInitialBalanceDisplay("");
      return;
    }
    const val = parseInt(cleanDigits, 10);
    setInitialBalance(val);
    setInitialBalanceDisplay(val.toLocaleString("id-ID"));
  };

  const handleCurrentBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanDigits = e.target.value.replace(/\D/g, "");
    if (!cleanDigits) {
      setCurrentBalanceInput(0);
      setCurrentBalanceDisplay("");
      return;
    }
    const val = parseInt(cleanDigits, 10);
    setCurrentBalanceInput(val);
    setCurrentBalanceDisplay(val.toLocaleString("id-ID"));
  };

  const handleCreditLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanDigits = e.target.value.replace(/\D/g, "");
    if (!cleanDigits) {
      setCreditLimit(0);
      setCreditLimitDisplay("");
      return;
    }
    const val = parseInt(cleanDigits, 10);
    setCreditLimit(val);
    setCreditLimitDisplay(val.toLocaleString("id-ID"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Account name is required");
      return;
    }

    setIsSubmitting(true);
    playSound("click", true);
    triggerHaptic(20);

    const credLim = type === "credit" ? creditLimit : undefined;
    const stmtDay = type === "credit" ? parseInt(statementDay) || 20 : undefined;

    try {
      if (accountToEdit) {
        // Check if balance adjustment is requested
        const targetBal = currentBalanceInput;
        const balDifference = safeSub(targetBal, accountToEdit.currentBalance);

        if (balDifference !== 0) {
          // Log adjustment entry
          const today = new Date().toISOString().split("T")[0];
          const hours = String(new Date().getHours()).padStart(2, "0");
          const minutes = String(new Date().getMinutes()).padStart(2, "0");

          await addTransactionWithLedgerSync({
            desc: `Balance Calibration [${name.trim()}]`,
            amount: Math.abs(balDifference),
            type: "adjustment",
            fromAccountId: accountToEdit.id,
            categoryId: "cat_util",
            tags: ["AuditAdjustment"],
            date: today,
            time: `${hours}:${minutes}`,
            note: `System ledger adjustment from ${formatCurrency(accountToEdit.currentBalance, currency, "id-ID")} to ${formatCurrency(targetBal, currency, "id-ID")}`,
            source: "web_client",
          }, user?.uid);
        }

        const updated: Account = {
          ...accountToEdit,
          name: name.trim(),
          type,
          currency,
          color,
          icon,
          creditLimit: credLim,
          statementClosingDay: stmtDay,
        };

        await saveAccount(updated, user?.uid);
      } else {
        // Create new account
        const existingAccounts = await db.accounts.toArray();
        const initBal = initialBalance;
        const newAcc: Account = {
          id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: name.trim(),
          type,
          currency,
          initialBalance: initBal,
          currentBalance: initBal,
          color,
          icon,
          creditLimit: credLim,
          statementClosingDay: stmtDay,
          order: existingAccounts.length,
          isArchived: false,
        };

        await saveAccount(newAcc, user?.uid);
      }

      playSound("success", true);
      triggerHaptic(30);
      onClose();
    } catch (err: unknown) {
      console.error("[AccountModal] Submit failed:", err);
      setError("Failed to save account. Please verify input values.");
      playSound("alert", true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveOrDelete = async () => {
    if (!accountToEdit) return;
    setIsSubmitting(true);
    playSound("click", true);

    try {
      // Check if transactions exist
      const txCount = await db.transactions
        .where("fromAccountId")
        .equals(accountToEdit.id)
        .or("toAccountId")
        .equals(accountToEdit.id)
        .count();

      if (txCount > 0 || accountToEdit.currentBalance !== 0) {
        // Archive account rather than hard deleting to preserve ledger audit trail
        const archived = { ...accountToEdit, isArchived: true };
        await saveAccount(archived, user?.uid);
      } else {
        // Safe to hard delete
        await deleteAccount(accountToEdit.id, user?.uid);
      }

      playSound("delete", true);
      onClose();
    } catch (err) {
      console.error("[AccountModal] Deletion error:", err);
      setError("Failed to archive/delete account");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 md:p-6 overflow-hidden"
    >
      <div
        className="w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[calc(100dvh-2rem)] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[var(--border-subtle)] bg-[var(--card-bg)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="flex-shrink-0 flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3 bg-[var(--card-surface)]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <h3 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
              {accountToEdit ? `Edit Account: ${accountToEdit.name}` : "New Account"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              playSound("click", true);
              onClose();
            }}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-2 rounded-lg hover:bg-[var(--bg-surface-2)] transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {/* Account Name */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Account Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. BCA Checking, Platinum CC, Cash"
                required
                className="w-full rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-slate-50 px-3.5 py-2.5 text-xs text-white dark:text-white light:text-slate-900 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 font-mono-num"
              />
            </div>

            {/* Type and Currency */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Account Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as AccountType)}
                  className="w-full rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[#0D111A] dark:bg-[#0D111A] light:bg-white px-3.5 py-2.5 text-xs text-white dark:text-white light:text-slate-900 focus:outline-none focus:border-emerald-500/50 font-mono-num"
                >
                  <option value="checking" className="bg-[#0F131C] text-white dark:bg-[#0F131C] dark:text-white light:bg-white light:text-slate-900">Checking / Everyday</option>
                  <option value="savings" className="bg-[#0F131C] text-white dark:bg-[#0F131C] dark:text-white light:bg-white light:text-slate-900">Savings Account</option>
                  <option value="credit" className="bg-[#0F131C] text-white dark:bg-[#0F131C] dark:text-white light:bg-white light:text-slate-900">Credit Card</option>
                  <option value="ewallet" className="bg-[#0F131C] text-white dark:bg-[#0F131C] dark:text-white light:bg-white light:text-slate-900">E-Wallet (GoPay, OVO, PayPal)</option>
                  <option value="cash" className="bg-[#0F131C] text-white dark:bg-[#0F131C] dark:text-white light:bg-white light:text-slate-900">Physical Cash</option>
                  <option value="investment" className="bg-[#0F131C] text-white dark:bg-[#0F131C] dark:text-white light:bg-white light:text-slate-900">Investment / Crypto</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Currency Code
                </label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  placeholder="IDR"
                  maxLength={4}
                  className="w-full rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-slate-50 px-3.5 py-2.5 text-xs text-white dark:text-white light:text-slate-900 focus:outline-none focus:border-emerald-500/50 font-mono-num"
                />
              </div>
            </div>

            {/* Balances */}
            {!accountToEdit ? (
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Initial Opening Balance ({currency})
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-zinc-400 font-mono-num text-sm select-none">
                    {currency === "IDR" ? "Rp" : currency}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={initialBalanceDisplay}
                    onChange={handleInitialBalanceChange}
                    placeholder="0"
                    className="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-slate-50 text-base text-white dark:text-white light:text-slate-900 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 font-mono-num font-bold tabular-nums"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-50 border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono-num">
                  <span className="text-zinc-400">Current Ledger Balance</span>
                  <span className="text-white dark:text-white light:text-slate-900 font-semibold tabular-nums">
                    {formatCurrency(accountToEdit.currentBalance, currency, "id-ID")}
                  </span>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Calibrate Balance (Generates adjustment entry)
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-zinc-400 font-mono-num text-xs select-none">
                      {currency === "IDR" ? "Rp" : currency}
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={currentBalanceDisplay}
                      onChange={handleCurrentBalanceChange}
                      placeholder="0"
                      className="w-full pl-12 pr-3.5 py-2 rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-white text-xs text-white dark:text-white light:text-slate-900 font-mono-num font-semibold tabular-nums focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Credit Card Specific Fields */}
            {type === "credit" && (
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-50 border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Credit Limit ({currency})
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-zinc-400 font-mono-num text-xs select-none">
                      {currency === "IDR" ? "Rp" : currency}
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={creditLimitDisplay}
                      onChange={handleCreditLimitChange}
                      placeholder="0"
                      className="w-full pl-10 pr-3 py-2 rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-white text-xs text-white dark:text-white light:text-slate-900 font-mono-num font-semibold tabular-nums focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Statement Closing Day
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={statementDay}
                    onChange={(e) => setStatementDay(e.target.value)}
                    placeholder="20"
                    className="w-full rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-white px-3 py-2 text-xs text-white dark:text-white light:text-slate-900 font-mono-num"
                  />
                </div>
              </div>
            )}

            {/* Color Palette Chips */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
                Account Color Identity
              </label>
              <div className="flex flex-wrap gap-2">
                {ACCOUNT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-6 w-6 rounded-full border-2 transition-transform ${
                      color === c ? "scale-125 border-white dark:border-white light:border-slate-800" : "border-transparent hover:scale-110"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Icon Picker */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
                Icon Identity
              </label>
              <div className="flex flex-wrap gap-2 p-2.5 rounded-xl bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-50 border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200">
                {Object.keys(ACCOUNT_ICONS).map((iconKey) => {
                  const IconComp = ACCOUNT_ICONS[iconKey];
                  const isSelected = icon === iconKey;
                  return (
                    <button
                      key={iconKey}
                      type="button"
                      onClick={() => setIcon(iconKey)}
                      className={`flex items-center justify-center p-2 rounded-lg border transition-colors ${
                        isSelected
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                          : "border-transparent text-zinc-400 hover:text-white light:hover:text-slate-900 hover:bg-white/[0.05]"
                      }`}
                    >
                      <IconComp className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-mono-num text-rose-400">
                {error}
              </div>
            )}

            {/* Archive / Delete trigger for existing account */}
            {accountToEdit && (
              <div className="pt-2 border-t border-white/[0.08] dark:border-white/[0.08] light:border-slate-200">
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-xs text-amber-400 hover:underline flex items-center gap-1.5 font-medium"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Archive or Delete Account
                  </button>
                ) : (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                    <p className="text-xs text-zinc-300 dark:text-zinc-300 light:text-slate-700">
                      {accountToEdit.currentBalance !== 0
                        ? `Account has an active balance of ${formatCurrency(accountToEdit.currentBalance, currency, "id-ID")}. Archiving it will preserve ledger balance integrity.`
                        : "Account has zero balance and can be safely archived or removed."}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-1.5 rounded-lg border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.05] text-xs font-medium text-zinc-300 dark:text-zinc-300 light:text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleArchiveOrDelete}
                        disabled={isSubmitting}
                        className="px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/20 text-xs text-rose-400 font-semibold"
                      >
                        Confirm Archive / Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="flex-shrink-0 border-t border-[var(--border-subtle)] px-4 py-3 bg-[var(--card-surface)] flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] transition-colors min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-2.5 text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-50 min-h-[44px] shadow-sm"
            >
              <Check className="h-4 w-4" />
              <span>{accountToEdit ? "Save Changes" : "Create Account"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
