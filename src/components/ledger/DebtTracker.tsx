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
          <Handshake className="h-4 w-4 text-[#FFB800]" />
          <h3 className="font-mono-num text-sm font-bold uppercase tracking-wider text-white">
            IOUs &amp; Debt Registry ({debts.length})
          </h3>
        </div>
        <button
          onClick={() => {
            playSound("click", soundEnabled);
            setIsAddOpen(true);
          }}
          className="flex items-center gap-1.5 rounded border border-[#232A3B] bg-[#0F131C] px-2.5 py-1 text-xs font-mono-num text-white hover:border-[#FFB800]/50 transition-colors"
        >
          <Plus className="h-3.5 w-3.5 text-[#FFB800]" />
          <span>NEW DEBT RECORD</span>
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
              className="industrial-card rounded-lg border border-[#232A3B] bg-[#0F131C] p-4 relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.2 text-[9px] font-mono-num uppercase font-bold ${
                        isOwe
                          ? "bg-[#FF5C00]/15 text-[#FF5C00] border border-[#FF5C00]/30"
                          : "bg-[#00FF88]/15 text-[#00FF88] border border-[#00FF88]/30"
                      }`}
                    >
                      {isOwe ? "PAYABLE (I OWE)" : "RECEIVABLE (OWED TO ME)"}
                    </span>
                    <span
                      className={`text-[9px] font-mono-num uppercase ${
                        isSettled ? "text-[#00FF88]" : "text-[#FFB800]"
                      }`}
                    >
                      {isSettled ? "[SETTLED]" : "[ACTIVE]"}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1">{debt.counterparty}</h4>
                  <p className="text-xs text-[#94A3B8] font-mono-num">{debt.desc}</p>
                </div>

                {!isSettled && (
                  <button
                    onClick={() => handleRepay(debt)}
                    className="flex items-center gap-1 rounded border border-[#FFB800]/50 bg-[#FFB800]/10 px-2 py-1 text-[10px] font-mono-num text-[#FFB800] hover:bg-[#FFB800]/20 transition-colors"
                  >
                    <span>LOG REPAYMENT</span>
                  </button>
                )}
              </div>

              {/* Amount Breakdown */}
              <div className="mt-3 pt-3 border-t border-[#232A3B]/60 flex items-end justify-between">
                <div>
                  <div className="text-[9px] font-mono-num text-[#64748B] uppercase">
                    REMAINING OUTSTANDING
                  </div>
                  <div
                    className={`font-mono-num text-base font-bold ${
                      privacyMode ? "privacy-blur" : ""
                    } ${isOwe ? "text-[#FF5C00]" : "text-[#00FF88]"}`}
                  >
                    {formatCurrency(remaining, currency, locale)}
                  </div>
                </div>

                <div className="text-right text-[10px] font-mono-num text-[#64748B]">
                  <div>Total: {formatCurrency(debt.amount, currency, locale)}</div>
                  <div>Paid: {formatCurrency(debt.paidAmount, currency, locale)}</div>
                  {debt.dueDate && <div className="text-[#FFB800]">Due: {debt.dueDate}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Debt Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-md rounded-lg border border-[#232A3B] bg-[#0F131C] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#232A3B] px-4 py-3 bg-[#07090E]">
              <h3 className="font-mono-num text-xs font-bold uppercase tracking-wider text-white">
                Register IOU / Debt Counterparty
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-[#64748B] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDebt} className="p-4 space-y-3.5">
              <div>
                <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                  Counterparty (Person or Organization)
                </label>
                <input
                  type="text"
                  value={counterparty}
                  onChange={(e) => setCounterparty(e.target.value)}
                  placeholder="e.g. Kenji, AWS Cloud Services"
                  className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                    Direction
                  </label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as "owe" | "owed")}
                    className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                  >
                    <option value="owe">I Owe (Payable)</option>
                    <option value="owed">Owed to Me (Receivable)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                    Principal Amount
                  </label>
                  <input
                    type="number"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder="0"
                    className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-1.5 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                  Description / Context
                </label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="e.g. Group dinner tab split, Modular synth loan"
                  className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                />
              </div>

              <button
                type="submit"
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded border border-[#FFB800]/60 bg-[#FFB800]/15 py-2 text-xs font-bold text-[#FFB800] hover:bg-[#FFB800]/25 transition-all font-mono-num"
              >
                <Check className="h-4 w-4" />
                RECORD DEBT ENTRY
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
