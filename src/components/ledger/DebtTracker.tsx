"use client";

import React, { useState } from "react";
import { Handshake, Plus, CheckCircle, Clock, AlertCircle, X, Check } from "lucide-react";
import { Debt } from "../../lib/types";
import { formatCurrency, safeSub } from "../../lib/mathEngine";
import { useUIStore } from "../../store/useUIStore";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "../../lib/auth/authContext";
import { saveDebt } from "../../lib/db/syncEngine";

export const DebtTracker: React.FC = () => {
  const { user } = useAuth();
  const { privacyMode, soundEnabled, openQuickTx } = useUIStore();

  const debts = useLiveQuery(() => db.debts.toArray()) ?? [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.get("main"));

  const currency = settings?.currency || "IDR";
  const locale = settings?.locale || "id-ID";

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [counterparty, setCounterparty] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [direction, setDirection] = useState<"owe" | "owed">("owe");
  const [dueDate, setDueDate] = useState("");
  const [desc, setDesc] = useState("");

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(amountStr);
    if (!counterparty.trim() || !amount) return;

    playSound("click", soundEnabled);
    triggerHaptic(20);

    const newDebt: Debt = {
      id: `debt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      counterparty: counterparty.trim(),
      amount: Math.abs(amount),
      paidAmount: 0,
      direction,
      dueDate: dueDate || undefined,
      desc: desc.trim() || "Loan ledger entry",
      status: "active",
      repaymentHistory: [],
      createdAt: new Date().toISOString(),
    };

    await saveDebt(newDebt, user?.uid);
    playSound("success", soundEnabled);
    setIsAddOpen(false);
    setCounterparty("");
    setAmountStr("");
    setDesc("");
  };

  const handleRepay = (debt: Debt) => {
    playSound("click", soundEnabled);
    triggerHaptic(15);
    const defaultAcc = accounts[0]?.id || "acc_bca";
    openQuickTx({
      type: "debt_payment",
      debtId: debt.id,
      amount: safeSub(debt.amount, debt.paidAmount),
      desc: `Repayment to ${debt.counterparty}`,
      fromAccountId: defaultAcc,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Handshake className="h-4 w-4 text-[var(--accent-primary)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            IOUs &amp; Debts ({debts.length})
          </h3>
        </div>
        <button
          onClick={() => {
            playSound("click", soundEnabled);
            setIsAddOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors min-h-[36px]"
        >
          <Plus className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
          <span>New Record</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {debts.map((debt) => {
          const remaining = safeSub(debt.amount, debt.paidAmount);
          const isSettled = debt.status === "settled" || remaining <= 0;
          const isOwe = debt.direction === "owe";

          return (
            <div
              key={debt.id}
              className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 relative overflow-hidden shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        isOwe
                          ? "bg-[var(--color-rose)]/10 text-[var(--color-rose)] border border-[var(--color-rose)]/20"
                          : "bg-[var(--color-emerald)]/10 text-[var(--color-emerald)] border border-[var(--color-emerald)]/20"
                      }`}
                    >
                      {isOwe ? "I Owe" : "Owed to Me"}
                    </span>
                    <span
                      className={`text-[10px] font-medium ${
                        isSettled ? "text-[var(--color-emerald)]" : "text-[var(--color-amber)]"
                      }`}
                    >
                      {isSettled ? "Settled" : "Active"}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] mt-1.5">{debt.counterparty}</h4>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{debt.desc}</p>
                </div>

                {!isSettled && (
                  <button
                    onClick={() => handleRepay(debt)}
                    className="flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-canvas)] px-2.5 py-1 text-xs font-medium text-[var(--accent-primary)] hover:bg-[var(--bg-hover)] transition-colors min-h-[32px]"
                  >
                    <span>Record Payment</span>
                  </button>
                )}
              </div>

              {/* Amount Breakdown */}
              <div className="mt-3 pt-3 border-t border-[var(--border-default)] flex items-end justify-between">
                <div>
                  <div className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                    Remaining
                  </div>
                  <div
                    className={`text-base font-bold mt-0.5 ${
                      privacyMode ? "privacy-blur" : ""
                    } ${isOwe ? "text-[var(--color-rose)]" : "text-[var(--color-emerald)]"}`}
                  >
                    {formatCurrency(remaining, currency, locale)}
                  </div>
                </div>

                <div className="text-right text-[11px] text-[var(--text-muted)]">
                  <div>Total: {formatCurrency(debt.amount, currency, locale)}</div>
                  <div>Paid: {formatCurrency(debt.paidAmount, currency, locale)}</div>
                  {debt.dueDate && <div className="text-[var(--color-amber)] font-medium">Due: {debt.dueDate}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Debt Modal */}
      {isAddOpen && (
        <div
          onClick={() => setIsAddOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-hidden"
        >
          <div
            className="w-full sm:max-w-md max-h-[92dvh] sm:max-h-[calc(100dvh-2rem)] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3 bg-[var(--bg-surface)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                New IOU / Debt Record
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-[var(--bg-hover)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDebt} className="p-4 space-y-3.5 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Person or Organization
                </label>
                <input
                  type="text"
                  value={counterparty}
                  onChange={(e) => setCounterparty(e.target.value)}
                  placeholder="e.g. Alex, Coworker"
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Direction
                  </label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as "owe" | "owed")}
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                  >
                    <option value="owe">I Owe (Payable)</option>
                    <option value="owed">Owed to Me (Receivable)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="e.g. Split dinner bill"
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-primary)] py-2.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity min-h-[44px]"
              >
                <Check className="h-4 w-4" />
                <span>Save Record</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
