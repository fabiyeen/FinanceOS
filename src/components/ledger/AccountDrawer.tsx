"use client";

import React from "react";
import { Plus, Wallet, ShieldAlert, ArrowRightLeft } from "lucide-react";
import { Account } from "../../lib/types";
import { AccountCard } from "./AccountCard";
import { formatCurrency, safeAdd } from "../../lib/mathEngine";
import { useUIStore } from "../../store/useUIStore";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "../../lib/auth/authContext";
import { saveAccount } from "../../lib/db/syncEngine";

export const AccountDrawer: React.FC = () => {
  const { user } = useAuth();
  const { privacyMode, soundEnabled, openQuickTx, openAccountModal } = useUIStore();

  const rawAccounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.get("main"));

  const currency = settings?.currency || "IDR";
  const locale = settings?.locale || "id-ID";

  // Sort by priority order, active accounts first
  const activeAccounts = [...rawAccounts]
    .filter((a) => !a.isArchived)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const archivedAccounts = [...rawAccounts]
    .filter((a) => a.isArchived)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Summaries
  let totalLiquid = 0;
  let totalLiabilities = 0;

  for (const acc of activeAccounts) {
    if (acc.type === "credit") {
      if (acc.currentBalance < 0) {
        totalLiabilities = safeAdd(totalLiabilities, Math.abs(acc.currentBalance));
      }
    } else {
      totalLiquid = safeAdd(totalLiquid, acc.currentBalance);
    }
  }

  const handleMoveAccount = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeAccounts.length) return;

    playSound("click", soundEnabled);
    triggerHaptic(15);

    const currentItem = { ...activeAccounts[index] };
    const targetItem = { ...activeAccounts[targetIndex] };

    const tempOrder = currentItem.order ?? index;
    currentItem.order = targetItem.order ?? targetIndex;
    targetItem.order = tempOrder;

    if (currentItem.order === targetItem.order) {
      currentItem.order = targetIndex;
      targetItem.order = index;
    }

    await saveAccount(currentItem, user?.uid);
    await saveAccount(targetItem, user?.uid);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] p-4 sm:p-5 shadow-xs transition-colors">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Liquid Capital
          </div>
          <div
            className={`font-mono-num text-lg sm:text-2xl font-bold text-emerald-500 mt-1.5 tabular-nums ${
              privacyMode ? "privacy-blur" : ""
            }`}
          >
            {formatCurrency(totalLiquid, currency, locale)}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Checking, Savings &amp; Cash reserves
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] p-4 sm:p-5 shadow-xs transition-colors">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Total Liabilities
          </div>
          <div
            className={`font-mono-num text-lg sm:text-2xl font-bold text-rose-500 mt-1.5 tabular-nums ${
              privacyMode ? "privacy-blur" : ""
            }`}
          >
            {formatCurrency(totalLiabilities, currency, locale)}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Credit card obligations
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-colors">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Quick Transfer
            </div>
            <div className="text-xs font-semibold text-[var(--text-primary)] mt-1.5">
              Move money between accounts
            </div>
          </div>
          <button
            onClick={() => {
              playSound("click", soundEnabled);
              triggerHaptic(15);
              openQuickTx({ type: "transfer" });
            }}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-slate-100 hover:border-emerald-500/50 px-3.5 py-2 text-xs text-emerald-500 transition-colors mt-3 font-semibold min-h-[40px]"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            <span>Transfer Funds</span>
          </button>
        </div>
      </div>

      {/* Account Cards Header & Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Accounts &amp; Wallets ({activeAccounts.length})
          </h3>
        </div>
        <button
          onClick={() => {
            playSound("click", soundEnabled);
            triggerHaptic(15);
            openAccountModal();
          }}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors shadow-sm min-h-[36px]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>+ Add Account</span>
        </button>
      </div>

      {/* Grid of Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {activeAccounts.map((acc, idx) => (
          <AccountCard
            key={acc.id}
            account={acc}
            onMoveUp={() => handleMoveAccount(idx, "up")}
            onMoveDown={() => handleMoveAccount(idx, "down")}
            canMoveUp={idx > 0}
            canMoveDown={idx < activeAccounts.length - 1}
          />
        ))}
      </div>

      {/* Archived Accounts (if any) */}
      {archivedAccounts.length > 0 && (
        <div className="pt-4 border-t border-white/[0.06] dark:border-white/[0.06] light:border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Archived Accounts ({archivedAccounts.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 opacity-60">
            {archivedAccounts.map((acc) => (
              <AccountCard key={acc.id} account={acc} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
