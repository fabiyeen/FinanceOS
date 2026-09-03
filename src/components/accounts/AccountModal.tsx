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
import { getFirebaseServices } from "../../lib/firebase/config";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { addTransactionWithLedgerSync } from "../../lib/db/syncEngine";

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
  const [initialBalance, setInitialBalance] = useState("");
  const [currentBalanceInput, setCurrentBalanceInput] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
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
        setInitialBalance(String(accountToEdit.initialBalance));
        setCurrentBalanceInput(String(accountToEdit.currentBalance));
        setCreditLimit(accountToEdit.creditLimit ? String(accountToEdit.creditLimit) : "");
        setStatementDay(accountToEdit.statementClosingDay ? String(accountToEdit.statementClosingDay) : "20");
        setColor(accountToEdit.color || "#00F0FF");
        setIcon(accountToEdit.icon || "Landmark");
      } else {
        setName("");
        setType("checking");
        setCurrency("IDR");
        setInitialBalance("0");
        setCurrentBalanceInput("0");
        setCreditLimit("");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Account name is required");
      return;
    }

    setIsSubmitting(true);
    playSound("click", true);
    triggerHaptic(20);

    const credLim = type === "credit" ? parseFloat(creditLimit) || 0 : undefined;
    const stmtDay = type === "credit" ? parseInt(statementDay) || 20 : undefined;
    const { firestore } = getFirebaseServices();

    try {
      if (accountToEdit) {
        // Check if balance adjustment is requested
        const targetBal = parseFloat(currentBalanceInput) || 0;
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
          });
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

        await db.accounts.put(updated);

        if (firestore && user?.uid && !user.isDemo) {
          try {
            await setDoc(doc(firestore, `users/${user.uid}/accounts/${updated.id}`), updated, { merge: true });
          } catch (err) {
            console.warn("[AccountModal] Cloud sync error:", err);
          }
        }
      } else {
        // Create new account
        const existingAccounts = await db.accounts.toArray();
        const initBal = parseFloat(initialBalance) || 0;
        const newAcc: Account = {
          id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          name: name.trim(),
          type,
          currency,
          initialBalance: initBal,
          currentBalance: initBal,
          color,
          icon,
          isArchived: false,
          order: existingAccounts.length,
          creditLimit: credLim,
          statementClosingDay: stmtDay,
        };

        await db.accounts.add(newAcc);

        if (firestore && user?.uid && !user.isDemo) {
          try {
            await setDoc(doc(firestore, `users/${user.uid}/accounts/${newAcc.id}`), newAcc);
          } catch (err) {
            console.warn("[AccountModal] Cloud sync error:", err);
          }
        }
      }

      playSound("success", true);
      onClose();
    } catch (err) {
      console.error("[AccountModal] Error saving account:", err);
      setError("Failed to save account details");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveOrDelete = async () => {
    if (!accountToEdit) return;
    setIsSubmitting(true);
    playSound("click", true);

    const { firestore } = getFirebaseServices();

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
        await db.accounts.put(archived);
        if (firestore && user?.uid && !user.isDemo) {
          await setDoc(doc(firestore, `users/${user.uid}/accounts/${archived.id}`), archived, { merge: true });
        }
      } else {
        // Safe to hard delete
        await db.accounts.delete(accountToEdit.id);
        if (firestore && user?.uid && !user.isDemo) {
          await deleteDoc(doc(firestore, `users/${user.uid}/accounts/${accountToEdit.id}`));
        }
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-6 overflow-hidden pb-[env(safe-area-inset-bottom)]"
    >
      <div
        className="w-full max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col rounded-xl border border-[#232A3B] bg-[#0F131C] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="flex-shrink-0 flex items-center justify-between border-b border-[#232A3B] px-4 py-3 bg-[#07090E]">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#00F0FF]" />
            <h3 className="font-mono-num text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
              {accountToEdit ? `Configure Account: ${accountToEdit.name}` : "Create New Financial Account"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              playSound("click", true);
              onClose();
            }}
            className="text-[#64748B] hover:text-white p-1 rounded hover:bg-[#161B26]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {/* Account Name */}
            <div>
              <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                Account Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. BCA Priority, Tokyo Platinum CC, Ledger Cold Wallet"
                required
                className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white placeholder-[#475569] focus:border-[#00F0FF] focus:outline-none font-mono-num"
              />
            </div>

            {/* Type and Currency */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                  Account Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as AccountType)}
                  className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                >
                  <option value="checking">Checking (Checking/Current)</option>
                  <option value="savings">Savings (High-Yield)</option>
                  <option value="credit">Credit Card (Revolving)</option>
                  <option value="ewallet">E-Wallet (GoPay, OVO, PayPal)</option>
                  <option value="cash">Cash (Physical Currency)</option>
                  <option value="investment">Investment / Brokerage</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                  Currency Code
                </label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  placeholder="IDR"
                  maxLength={4}
                  className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                />
              </div>
            </div>

            {/* Balances */}
            {!accountToEdit ? (
              <div>
                <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                  Initial Opening Balance ({currency})
                </label>
                <input
                  type="number"
                  step="any"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  placeholder="0"
                  className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white placeholder-[#475569] focus:border-[#00F0FF] focus:outline-none font-mono-num font-bold"
                />
              </div>
            ) : (
              <div className="p-3 rounded bg-[#07090E] border border-[#232A3B] space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono-num">
                  <span className="text-[#64748B] uppercase">Current Ledger Balance</span>
                  <span className="text-white font-bold">
                    {formatCurrency(accountToEdit.currentBalance, currency, "id-ID")}
                  </span>
                </div>
                <div>
                  <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                    Calibrate Balance (Generates adjustment entry)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={currentBalanceInput}
                    onChange={(e) => setCurrentBalanceInput(e.target.value)}
                    className="w-full rounded border border-[#232A3B] bg-[#161B26] px-3 py-1.5 text-xs text-white font-mono-num"
                  />
                </div>
              </div>
            )}

            {/* Credit Card Specific Fields */}
            {type === "credit" && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded bg-[#07090E] border border-[#232A3B]">
                <div>
                  <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                    Credit Limit ({currency})
                  </label>
                  <input
                    type="number"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    placeholder="e.g. 50000000"
                    className="w-full rounded border border-[#232A3B] bg-[#161B26] px-3 py-1.5 text-xs text-white font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                    Statement Closing Day
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={statementDay}
                    onChange={(e) => setStatementDay(e.target.value)}
                    placeholder="20"
                    className="w-full rounded border border-[#232A3B] bg-[#161B26] px-3 py-1.5 text-xs text-white font-mono-num"
                  />
                </div>
              </div>
            )}

            {/* Color Palette Chips */}
            <div>
              <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1.5">
                Account Color Identity
              </label>
              <div className="flex flex-wrap gap-2">
                {ACCOUNT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-6 w-6 rounded-full border-2 transition-transform ${
                      color === c ? "scale-125 border-white" : "border-transparent hover:scale-110"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Icon Picker */}
            <div>
              <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1.5">
                Icon Identity
              </label>
              <div className="flex flex-wrap gap-2 p-2 rounded bg-[#07090E] border border-[#232A3B]">
                {Object.keys(ACCOUNT_ICONS).map((iconKey) => {
                  const IconComp = ACCOUNT_ICONS[iconKey];
                  const isSelected = icon === iconKey;
                  return (
                    <button
                      key={iconKey}
                      type="button"
                      onClick={() => setIcon(iconKey)}
                      className={`flex items-center justify-center p-2 rounded border transition-colors ${
                        isSelected
                          ? "border-[#00F0FF] bg-[#00F0FF]/20 text-[#00F0FF]"
                          : "border-transparent text-[#64748B] hover:text-white hover:bg-[#161B26]"
                      }`}
                    >
                      <IconComp className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="rounded border border-[#FF0055]/40 bg-[#FF0055]/10 p-2 text-xs font-mono-num text-[#FF0055]">
                [ERROR]: {error}
              </div>
            )}

            {/* Archive / Delete trigger for existing account */}
            {accountToEdit && (
              <div className="pt-2 border-t border-[#232A3B]">
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-xs font-mono-num text-[#FF5C00] hover:underline flex items-center gap-1"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Archive or Expunge Account
                  </button>
                ) : (
                  <div className="p-3 rounded bg-[#FF5C00]/10 border border-[#FF5C00]/30 space-y-2">
                    <p className="text-xs text-[#94A3B8] font-mono-num">
                      {accountToEdit.currentBalance !== 0
                        ? `Account has an active balance of ${formatCurrency(accountToEdit.currentBalance, currency, "id-ID")}. Archiving it will preserve ledger balance integrity.`
                        : "Account has zero balance and can be safely archived or removed."}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-1 rounded border border-[#232A3B] bg-[#161B26] text-xs font-mono-num text-[#94A3B8]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleArchiveOrDelete}
                        disabled={isSubmitting}
                        className="px-3 py-1 rounded border border-[#FF0055] bg-[#FF0055]/20 text-xs font-mono-num text-[#FF0055] font-bold"
                      >
                        Confirm Archive / Expunge
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="flex-shrink-0 border-t border-[#232A3B] px-4 py-3 bg-[#07090E] flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded border border-[#232A3B] bg-[#161B26] py-2 text-xs font-mono-num text-[#94A3B8] hover:text-white"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-1.5 rounded border border-[#00F0FF]/60 bg-[#00F0FF]/15 py-2 text-xs font-bold font-mono-num text-[#00F0FF] hover:bg-[#00F0FF]/25 shadow-[0_0_12px_rgba(0,240,255,0.2)] disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              <span>{accountToEdit ? "UPDATE ACCOUNT" : "CREATE ACCOUNT"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
