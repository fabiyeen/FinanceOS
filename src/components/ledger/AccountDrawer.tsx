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
            Total Liabilities
          </div>
          <div
            className={`font-mono-num text-lg sm:text-xl font-bold text-[#FF5C00] mt-1 ${
              privacyMode ? "privacy-blur" : ""
            }`}
          >
            {formatCurrency(totalLiabilities, currency, locale)}
          </div>
          <div className="text-[10px] font-mono-num text-[#94A3B8] mt-0.5">
            Credit card obligations
          </div>
        </div>

        <div className="industrial-card rounded-xl p-4 border border-[var(--border-subtle)] bg-[var(--card-bg)] flex flex-col justify-between">
          <div>
            <div className="text-xs font-medium text-[var(--text-muted)]">
              Quick Transfer
            </div>
            <div className="text-xs font-semibold text-[var(--text-primary)] mt-1">
              Internal Rebalancing
            </div>
          </div>
          <button
            onClick={() => {
              playSound("click", soundEnabled);
              triggerHaptic(15);
              openQuickTx({ type: "transfer" });
            }}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3 py-2 text-xs text-emerald-500 hover:border-emerald-500/50 transition-colors mt-2 font-medium min-h-[40px]"
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
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors shadow-sm min-h-[36px]"
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
        <div className="pt-4 border-t border-[#232A3B] space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono-num text-[#64748B] uppercase">
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
