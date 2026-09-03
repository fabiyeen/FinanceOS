"use client";

import React, { useState } from "react";
import { Plus, Wallet, ShieldAlert, ArrowRightLeft, X, Check } from "lucide-react";
import { Account, AccountType } from "../../lib/types";
import { AccountCard } from "./AccountCard";
import { formatCurrency, safeAdd } from "../../lib/mathEngine";
import { useUIStore } from "../../store/useUIStore";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";

export const AccountDrawer: React.FC = () => {
  const { privacyMode, soundEnabled, openQuickTx } = useUIStore();

  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.get("main"));

  const currency = settings?.currency || "IDR";
  const locale = settings?.locale || "id-ID";

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [initialBalance, setInitialBalance] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [statementDay, setStatementDay] = useState("20");
  const [color, setColor] = useState("#00F0FF");

  // Summaries
  let totalLiquid = 0;
  let totalLiabilities = 0;

  for (const acc of accounts) {
    if (acc.isArchived) continue;
    if (acc.type === "credit") {
      if (acc.currentBalance < 0) {
        totalLiabilities = safeAdd(totalLiabilities, Math.abs(acc.currentBalance));
      }
    } else {
      totalLiquid = safeAdd(totalLiquid, acc.currentBalance);
    }
  }

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    playSound("click", soundEnabled);
    triggerHaptic(20);

    const initBal = parseFloat(initialBalance) || 0;
    const credLim = type === "credit" ? parseFloat(creditLimit) || 0 : undefined;
    const stmtDay = type === "credit" ? parseInt(statementDay) || 20 : undefined;

    const newAcc: Account = {
      id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: name.trim(),
      type,
      currency,
      initialBalance: initBal,
      currentBalance: initBal,
      color,
      icon: type === "credit" ? "CreditCard" : "Landmark",
      isArchived: false,
      creditLimit: credLim,
      statementClosingDay: stmtDay,
    };

    await db.accounts.add(newAcc);
    playSound("success", soundEnabled);
    setIsAddOpen(false);
    setName("");
    setInitialBalance("");
    setCreditLimit("");
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="industrial-card rounded-lg p-4 border border-[#232A3B] bg-[#0F131C]">
          <div className="text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00FF88]" />
            Liquid Capital
          </div>
          <div
            className={`font-mono-num text-lg sm:text-xl font-bold text-[#00FF88] mt-1 ${
              privacyMode ? "privacy-blur" : ""
            }`}
          >
            {formatCurrency(totalLiquid, currency, locale)}
          </div>
          <div className="text-[10px] font-mono-num text-[#94A3B8] mt-0.5">
            Checking, Savings &amp; Cash reserves
          </div>
        </div>

        <div className="industrial-card rounded-lg p-4 border border-[#232A3B] bg-[#0F131C]">
          <div className="text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF5C00]" />
            Credit Card Liabilities
          </div>
          <div
            className={`font-mono-num text-lg sm:text-xl font-bold text-[#FF5C00] mt-1 ${
              privacyMode ? "privacy-blur" : ""
            }`}
          >
            {totalLiabilities > 0 ? `-${formatCurrency(totalLiabilities, currency, locale)}` : "IDR 0"}
          </div>
          <div className="text-[10px] font-mono-num text-[#94A3B8] mt-0.5">
            Active revolving credit balance
          </div>
        </div>

        <div className="industrial-card rounded-lg p-4 border border-[#232A3B] bg-[#0F131C] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono-num uppercase tracking-wider text-[#64748B]">
              Quick Inter-Account
            </div>
            <div className="text-xs font-mono-num text-[#94A3B8] mt-1">
              Zero-sum atomic balance transfer
            </div>
          </div>
          <button
            onClick={() => {
              playSound("click", soundEnabled);
              openQuickTx({ type: "transfer" });
            }}
            className="flex items-center gap-1.5 rounded border border-[#00F0FF]/50 bg-[#00F0FF]/10 px-3 py-2 text-xs font-mono-num text-[#00F0FF] hover:bg-[#00F0FF]/20 transition-colors"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            TRANSFER
          </button>
        </div>
      </div>

      {/* Account Cards Header & Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[#00F0FF]" />
          <h3 className="font-mono-num text-sm font-bold uppercase tracking-wider text-white">
            Active Accounts ({accounts.length})
          </h3>
        </div>
        <button
          onClick={() => {
            playSound("click", soundEnabled);
            setIsAddOpen(true);
          }}
          className="flex items-center gap-1.5 rounded border border-[#232A3B] bg-[#0F131C] px-2.5 py-1 text-xs font-mono-num text-white hover:border-[#00F0FF]/50 transition-colors"
        >
          <Plus className="h-3.5 w-3.5 text-[#00F0FF]" />
          <span>ADD ACCOUNT</span>
        </button>
      </div>

      {/* Grid of Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {accounts.map((acc) => (
          <AccountCard key={acc.id} account={acc} />
        ))}
      </div>

      {/* Add Account Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-md rounded-lg border border-[#232A3B] bg-[#0F131C] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#232A3B] px-4 py-3 bg-[#07090E]">
              <h3 className="font-mono-num text-xs font-bold uppercase tracking-wider text-white">
                Create New Financial Account
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-[#64748B] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-4 space-y-3.5">
              <div>
                <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. BCA Digital, Tokyo Platinum CC"
                  className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AccountType)}
                    className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="credit">Credit Card</option>
                    <option value="ewallet">E-Wallet</option>
                    <option value="cash">Cash</option>
                    <option value="investment">Investment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                    Initial Balance
                  </label>
                  <input
                    type="number"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    placeholder="0"
                    className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                  />
                </div>
              </div>

              {type === "credit" && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded bg-[#07090E] border border-[#232A3B]">
                  <div>
                    <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                      Credit Limit
                    </label>
                    <input
                      type="number"
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(e.target.value)}
                      placeholder="e.g. 50000000"
                      className="w-full rounded border border-[#232A3B] bg-[#161B26] px-2.5 py-1.5 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                      Closing Day
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={statementDay}
                      onChange={(e) => setStatementDay(e.target.value)}
                      className="w-full rounded border border-[#232A3B] bg-[#161B26] px-2.5 py-1.5 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                  Accent Color
                </label>
                <div className="flex gap-2">
                  {["#00F0FF", "#00FF88", "#FFB800", "#FF5C00", "#9D00FF", "#94A3B8"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="h-6 w-6 rounded-full border border-white/20 transition-transform"
                      style={{
                        backgroundColor: c,
                        transform: color === c ? "scale(1.2)" : "scale(1)",
                        boxShadow: color === c ? `0 0 10px ${c}` : "none",
                      }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded border border-[#00F0FF]/60 bg-[#00F0FF]/15 py-2 text-xs font-bold text-[#00F0FF] hover:bg-[#00F0FF]/25 transition-all font-mono-num"
              >
                <Check className="h-4 w-4" />
                CREATE ACCOUNT
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
