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
import { getFirebaseServices } from "../../lib/firebase/config";
import { doc, setDoc } from "firebase/firestore";

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

    await db.accounts.bulkPut([currentItem, targetItem]);

    const { firestore } = getFirebaseServices();
    if (firestore && user?.uid && !user.isDemo) {
      try {
        await Promise.all([
          setDoc(doc(firestore, `users/${user.uid}/accounts/${currentItem.id}`), currentItem, { merge: true }),
          setDoc(doc(firestore, `users/${user.uid}/accounts/${targetItem.id}`), targetItem, { merge: true }),
        ]);
      } catch (err) {
        console.warn("[AccountDrawer] Order sync notice:", err);
      }
    }
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

        <div className="industrial-card rounded-lg p-4 border border-[#232A3B] bg-[#0F131C] flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-mono-num uppercase tracking-wider text-[#64748B]">
              Quick Liquidity Routing
            </div>
            <div className="text-xs font-mono-num text-white mt-1">
              Internal Rebalancing
            </div>
          </div>
          <button
            onClick={() => {
              playSound("click", soundEnabled);
              triggerHaptic(15);
              openQuickTx({ type: "transfer" });
            }}
            className="flex items-center gap-1.5 rounded border border-[#00F0FF]/50 bg-[#00F0FF]/10 px-3 py-2 text-xs font-mono-num text-[#00F0FF] hover:bg-[#00F0FF]/20 transition-colors mt-2"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            <span>INTER-ACCOUNT TRANSFER</span>
          </button>
        </div>
      </div>

      {/* Account Cards Header & Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[#00F0FF]" />
          <h3 className="font-mono-num text-sm font-bold uppercase tracking-wider text-white">
            Active Accounts &amp; Priority ({activeAccounts.length})
          </h3>
        </div>
        <button
          onClick={() => {
            playSound("click", soundEnabled);
            triggerHaptic(15);
            openAccountModal();
          }}
          className="flex items-center gap-1.5 rounded border border-[#00F0FF]/60 bg-[#00F0FF]/15 px-3 py-1.5 text-xs font-mono-num font-bold text-[#00F0FF] hover:bg-[#00F0FF]/25 transition-colors shadow-[0_0_12px_rgba(0,240,255,0.15)]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>ADD ACCOUNT</span>
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
