"use client";

import React, { useState } from "react";
import { Repeat, Plus, Check, Play, X, Zap } from "lucide-react";
import { RecurringRule } from "../../lib/types";
import { formatCurrency } from "../../lib/mathEngine";
import { useUIStore } from "../../store/useUIStore";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "../../lib/auth/authContext";
import { processDueRecurringRules, saveRecurringRule } from "../../lib/db/syncEngine";

export const RecurringRulesManager: React.FC = () => {
  const { user } = useAuth();
  const { privacyMode, soundEnabled } = useUIStore();

  const recurringRules = useLiveQuery(() => db.recurring.toArray()) ?? [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.get("main"));

  const currency = settings?.currency || "IDR";
  const locale = settings?.locale || "id-ID";

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [frequency, setFrequency] = useState<RecurringRule["frequency"]>("monthly");
  const [nextRunDate, setNextRunDate] = useState(new Date().toISOString().split("T")[0]);
  const [autoExecute, setAutoExecute] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(amountStr);
    if (!title.trim() || !amount) return;

    playSound("click", soundEnabled);
    triggerHaptic(20);

    const defaultAcc = accounts[0]?.id || "acc_bca";
    const defaultCat = categories[0]?.id || "cat_subs";

    const newRule: RecurringRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      title: title.trim(),
      amount: Math.abs(amount),
      type,
      frequency,
      interval: 1,
      startDate: new Date().toISOString().split("T")[0],
      accountId: defaultAcc,
      categoryId: defaultCat,
      nextRunDate: nextRunDate || new Date().toISOString().split("T")[0],
      autoExecute,
    };

    await saveRecurringRule(newRule, user?.uid);
    playSound("success", soundEnabled);
    setIsAddOpen(false);
    setTitle("");
    setAmountStr("");
  };

  const handleRunDue = async () => {
    playSound("click", soundEnabled);
    triggerHaptic(20);
    setIsProcessing(true);
    setStatusMsg("Checking and processing due recurring transactions...");
    try {
      const count = await processDueRecurringRules(user?.uid);
      setStatusMsg(count > 0 ? `Successfully executed ${count} due recurring item(s).` : "No recurring transactions are due today.");
      setTimeout(() => setStatusMsg(""), 4000);
    } catch {
      setStatusMsg("Failed to execute recurring transactions.");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleAutoExecute = async (rule: RecurringRule) => {
    playSound("toggle", soundEnabled);
    triggerHaptic(15);
    const updated = { ...rule, autoExecute: !rule.autoExecute };
    await saveRecurringRule(updated, user?.uid);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Recurring Bills &amp; Subscriptions ({recurringRules.length})
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunDue}
            disabled={isProcessing}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-500 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 font-medium"
          >
            <Zap className={`h-3.5 w-3.5 ${isProcessing ? "animate-spin" : ""}`} />
            <span>Process Due</span>
          </button>

          <button
            onClick={() => {
              playSound("click", soundEnabled);
              setIsAddOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors font-medium"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-500" />
            <span>New Rule</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-500 font-medium">
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
              className="rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] p-4 sm:p-5 relative overflow-hidden transition-colors shadow-xs"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/[0.04] dark:bg-white/[0.04] light:bg-slate-100 border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200 px-2.5 py-0.5 text-[10px] text-cyan-400 capitalize font-medium">
                      {rule.frequency}
                    </span>
                    <span className="rounded-full bg-white/[0.04] dark:bg-white/[0.04] light:bg-slate-100 border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200 px-2.5 py-0.5 text-[10px] text-[var(--text-secondary)] font-medium">
                      {cat?.name || "Subscription"}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] mt-1.5">{rule.title}</h4>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Account: {acc?.name || rule.accountId}
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-mono-num text-sm sm:text-base font-bold tabular-nums ${
                      privacyMode ? "privacy-blur" : ""
                    } ${rule.type === "income" ? "text-emerald-500" : "text-rose-500"}`}
                  >
                    {rule.type === "income" ? "+" : "-"}
                    {formatCurrency(rule.amount, currency, locale)}
                  </div>
                  <div className="text-[10px] font-mono-num text-[var(--text-muted)] mt-0.5">
                    Next: {rule.nextRunDate}
                  </div>
                </div>
              </div>

              {/* Bottom toggle */}
              <div className="mt-3.5 pt-3 border-t border-white/[0.06] dark:border-white/[0.06] light:border-slate-200 flex items-center justify-between text-xs">
                <span className="text-[11px] text-[var(--text-muted)]">
                  Auto-post: {rule.autoExecute ? "Automatic" : "Manual approval"}
                </span>
                <button
                  onClick={() => toggleAutoExecute(rule)}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] transition-colors border font-medium ${
                    rule.autoExecute
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-500"
                      : "border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-100 text-[var(--text-muted)]"
                  }`}
                >
                  {rule.autoExecute ? "Auto On" : "Auto Off"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Recurring Rule Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-white/[0.1] dark:border-white/[0.1] light:border-slate-200 bg-[var(--bg-surface)] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 px-5 py-4 bg-[var(--bg-canvas)]/30">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Add Recurring Bill or Subscription
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Netflix, Spotify, Gym, Rent"
                  className="w-full rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-emerald-500/50 focus:outline-none transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as "expense" | "income")}
                    className="w-full rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-secondary)] focus:border-emerald-500/50 focus:outline-none transition-colors"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                    Amount ({currency})
                  </label>
                  <input
                    type="number"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-emerald-500/50 focus:outline-none transition-colors font-mono-num"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as RecurringRule["frequency"])}
                    className="w-full rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-secondary)] focus:border-emerald-500/50 focus:outline-none transition-colors"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly (2 weeks)</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                    First / Next Due Date
                  </label>
                  <input
                    type="date"
                    value={nextRunDate}
                    onChange={(e) => setNextRunDate(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-secondary)] focus:border-emerald-500/50 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoExec"
                  checked={autoExecute}
                  onChange={(e) => setAutoExecute(e.target.checked)}
                  className="rounded border-white/[0.2] bg-[var(--bg-surface)] text-emerald-500 focus:ring-0"
                />
                <label htmlFor="autoExec" className="text-xs text-[var(--text-secondary)]">
                  Automatically add transaction when due date arrives
                </label>
              </div>

              <button
                type="submit"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-semibold text-white transition-all shadow-sm"
              >
                <Check className="h-4 w-4" />
                <span>Save Recurring Rule</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
