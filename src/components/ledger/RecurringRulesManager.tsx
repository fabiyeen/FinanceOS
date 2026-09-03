"use client";

import React, { useState } from "react";
import { Repeat, Zap, Plus, Check, X, AlertTriangle } from "lucide-react";
import { RecurringRule } from "../../lib/types";
import { formatCurrency } from "../../lib/mathEngine";
import { useUIStore } from "../../store/useUIStore";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { db } from "../../lib/db/dexie";
import { processDueRecurringRules } from "../../lib/db/syncEngine";
import { useLiveQuery } from "dexie-react-hooks";

export const RecurringRulesManager: React.FC = () => {
  const { privacyMode, soundEnabled } = useUIStore();

  const recurringRules = useLiveQuery(() => db.recurring.toArray()) ?? [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.get("main"));

  const currency = settings?.currency || "IDR";
  const locale = settings?.locale || "id-ID";

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [frequency, setFrequency] = useState<RecurringRule["frequency"]>("monthly");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [nextRunDate, setNextRunDate] = useState("");
  const [autoExecute, setAutoExecute] = useState(true);

  const handleRunDue = async () => {
    setIsProcessing(true);
    playSound("click", soundEnabled);
    triggerHaptic(20);

    try {
      const executed = await processDueRecurringRules();
      setStatusMsg(`Processed ${executed} due recurring rules`);
      playSound("success", soundEnabled);
      setTimeout(() => setStatusMsg(null), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(amountStr);
    if (!title.trim() || !amount) return;

    playSound("click", soundEnabled);
    triggerHaptic(20);

    const defaultAcc = accountId || accounts[0]?.id || "acc_bca";
    const defaultCat = categoryId || categories[0]?.id || "cat_subs";
    const startDate = new Date().toISOString().split("T")[0];

    const newRule: RecurringRule = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      title: title.trim(),
      amount: Math.abs(amount),
      type,
      categoryId: defaultCat,
      accountId: defaultAcc,
      frequency,
      interval: 1,
      startDate,
      nextRunDate: nextRunDate || startDate,
      autoExecute,
    };

    await db.recurring.add(newRule);
    playSound("success", soundEnabled);
    setIsAddOpen(false);
    setTitle("");
    setAmountStr("");
  };

  const toggleAutoExecute = async (rule: RecurringRule) => {
    playSound("toggle", soundEnabled);
    await db.recurring.update(rule.id, { autoExecute: !rule.autoExecute });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-[#00F0FF]" />
          <h3 className="font-mono-num text-sm font-bold uppercase tracking-wider text-white">
            Recurring Rules &amp; Subscriptions ({recurringRules.length})
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunDue}
            disabled={isProcessing}
            className="flex items-center gap-1.5 rounded border border-[#00FF88]/40 bg-[#00FF88]/10 px-2.5 py-1 text-xs font-mono-num text-[#00FF88] hover:bg-[#00FF88]/20 transition-colors disabled:opacity-50"
          >
            <Zap className={`h-3.5 w-3.5 ${isProcessing ? "animate-spin" : ""}`} />
            <span>TRIGGER DUE NOW</span>
          </button>

          <button
            onClick={() => {
              playSound("click", soundEnabled);
              setIsAddOpen(true);
            }}
            className="flex items-center gap-1 rounded border border-[#232A3B] bg-[#0F131C] px-2.5 py-1 text-xs font-mono-num text-white hover:border-[#00F0FF]/50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5 text-[#00F0FF]" />
            <span>NEW RULE</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="rounded border border-[#00FF88]/40 bg-[#00FF88]/10 p-2 text-xs font-mono-num text-[#00FF88]">
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {recurringRules.map((rule) => {
          const acc = accounts.find((a) => a.id === rule.accountId);
          const cat = categories.find((c) => c.id === rule.categoryId);

          return (
            <div
              key={rule.id}
              className="industrial-card rounded-lg border border-[#232A3B] bg-[#0F131C] p-4 relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-[#1E2536] border border-[#232A3B] px-1.5 py-0.2 text-[9px] font-mono-num uppercase text-[#00F0FF]">
                      {rule.frequency}
                    </span>
                    <span className="rounded bg-[#1E2536] border border-[#232A3B] px-1.5 py-0.2 text-[9px] font-mono-num uppercase text-[#94A3B8]">
                      {cat?.name || "Subscription"}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1">{rule.title}</h4>
                  <div className="text-[10px] font-mono-num text-[#64748B] mt-0.5">
                    Account: {acc?.name || rule.accountId}
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-mono-num text-sm font-bold ${
                      privacyMode ? "privacy-blur" : ""
                    } ${rule.type === "income" ? "text-[#00FF88]" : "text-[#FF5C00]"}`}
                  >
                    {rule.type === "income" ? "+" : "-"}
                    {formatCurrency(rule.amount, currency, locale)}
                  </div>
                  <div className="text-[9px] font-mono-num text-[#64748B]">
                    NEXT: {rule.nextRunDate}
                  </div>
                </div>
              </div>

              {/* Bottom toggle */}
              <div className="mt-3 pt-2.5 border-t border-[#232A3B]/60 flex items-center justify-between text-xs font-mono-num">
                <span className="text-[10px] text-[#94A3B8]">
                  Auto-Execute: {rule.autoExecute ? "ENABLED" : "MANUAL APPROVAL"}
                </span>
                <button
                  onClick={() => toggleAutoExecute(rule)}
                  className={`rounded px-2 py-0.5 text-[10px] transition-colors border ${
                    rule.autoExecute
                      ? "border-[#00FF88]/40 bg-[#00FF88]/15 text-[#00FF88]"
                      : "border-[#232A3B] bg-[#161B26] text-[#64748B]"
                  }`}
                >
                  {rule.autoExecute ? "AUTO [ON]" : "AUTO [OFF]"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Recurring Rule Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-md rounded-lg border border-[#232A3B] bg-[#0F131C] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#232A3B] px-4 py-3 bg-[#07090E]">
              <h3 className="font-mono-num text-xs font-bold uppercase tracking-wider text-white">
                Register Recurring Schedule / Subscription
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-[#64748B] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="p-4 space-y-3.5">
              <div>
                <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Netflix, OpenAI API, Syndicate Retainer"
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
                    onChange={(e) => setType(e.target.value as "expense" | "income")}
                    className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                    Amount ({currency})
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as RecurringRule["frequency"])}
                    className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly (2 weeks)</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                    First / Next Run Date
                  </label>
                  <input
                    type="date"
                    value={nextRunDate}
                    onChange={(e) => setNextRunDate(e.target.value)}
                    className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-1.5 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoExec"
                  checked={autoExecute}
                  onChange={(e) => setAutoExecute(e.target.checked)}
                  className="rounded border-[#232A3B] bg-[#07090E] text-[#00F0FF] focus:ring-0"
                />
                <label htmlFor="autoExec" className="text-xs font-mono-num text-[#94A3B8]">
                  Auto-Execute when date arrives
                </label>
              </div>

              <button
                type="submit"
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded border border-[#00F0FF]/60 bg-[#00F0FF]/15 py-2 text-xs font-bold text-[#00F0FF] hover:bg-[#00F0FF]/25 transition-all font-mono-num"
              >
                <Check className="h-4 w-4" />
                CREATE RECURRING SCHEDULE
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
