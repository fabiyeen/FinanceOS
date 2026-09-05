"use client";

import React from "react";
import {
  CreditCard,
  Landmark,
  Building2,
  Smartphone,
  Banknote,
  TrendingUp,
  ArrowRightLeft,
  Edit2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Account } from "../../lib/types";
import { formatCurrency, safeSub } from "../../lib/mathEngine";
import { useUIStore } from "../../store/useUIStore";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";

interface AccountCardProps {
  account: Account;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}) => {
  const { privacyMode, soundEnabled, openQuickTx, openAccountModal } = useUIStore();

  const getAccountIcon = (type: Account["type"]) => {
    switch (type) {
      case "checking":
        return Landmark;
      case "savings":
        return Building2;
      case "credit":
        return CreditCard;
      case "ewallet":
        return Smartphone;
      case "cash":
        return Banknote;
      case "investment":
        return TrendingUp;
    }
  };

  const Icon = getAccountIcon(account.type);
  const isCredit = account.type === "credit";

  // Credit Card Headroom Calculations
  const creditLimit = account.creditLimit || 0;
  const balanceOwed = account.currentBalance < 0 ? Math.abs(account.currentBalance) : 0;
  const availableCredit = creditLimit > 0 ? Math.max(0, safeSub(creditLimit, balanceOwed)) : 0;
  const creditUtilizationRatio = creditLimit > 0 ? Math.min(100, Math.round((balanceOwed / creditLimit) * 100)) : 0;

  const handleQuickTransfer = () => {
    playSound("click", soundEnabled);
    triggerHaptic(15);
    openQuickTx({
      type: "transfer",
      fromAccountId: account.id,
    });
  };

  const handleEditAccount = () => {
    playSound("click", soundEnabled);
    triggerHaptic(15);
    openAccountModal(account);
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] p-4 sm:p-5 relative overflow-hidden group hover:border-white/[0.14] transition-all shadow-xs">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Priority Reordering Controls */}
          {(onMoveUp || onMoveDown) && (
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={!canMoveUp}
                className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                title="Move Priority Up"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={!canMoveDown}
                className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                title="Move Priority Down"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </div>
          )}

          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200 bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-100"
            style={{ color: account.color }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">{account.name}</h4>
              <span className="rounded-full bg-white/[0.04] dark:bg-white/[0.04] light:bg-slate-100 border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200 px-2 py-0.5 text-[10px] text-[var(--text-muted)] capitalize font-medium">
                {account.type}
              </span>
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono-num">
              Currency: {account.currency}
            </div>
          </div>
        </div>

        {/* Actions: Edit & Quick Transfer */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleEditAccount}
            className="rounded-lg border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200 bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-100 p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Edit account"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleQuickTransfer}
            className="rounded-lg border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200 bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-100 p-1.5 text-[var(--text-muted)] hover:text-cyan-400 transition-colors"
            title="Transfer from account"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Balance Readout */}
      <div className="mt-4 pt-3 border-t border-white/[0.06] dark:border-white/[0.06] light:border-slate-200 flex items-end justify-between">
        <div>
          <span className="text-[11px] font-medium text-[var(--text-muted)]">
            {isCredit ? "Balance Owed" : "Available Balance"}
          </span>
          <div
            className={`font-mono-num text-base sm:text-lg font-bold tracking-tight transition-all tabular-nums ${
              privacyMode ? "privacy-blur" : ""
            } ${
              isCredit
                ? balanceOwed > 0
                  ? "text-rose-500"
                  : "text-emerald-500"
                : account.currentBalance >= 0
                ? "text-[var(--text-primary)]"
                : "text-rose-500"
            }`}
          >
            {isCredit && balanceOwed > 0 ? "-" : ""}
            {formatCurrency(
              isCredit ? balanceOwed : account.currentBalance,
              account.currency,
              "id-ID"
            )}
          </div>
        </div>

        {isCredit && account.statementClosingDay && (
          <div className="text-right">
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              Statement
            </span>
            <div className="text-xs font-mono-num text-amber-500 font-medium tabular-nums">
              Day {account.statementClosingDay}
            </div>
          </div>
        )}
      </div>

      {/* Credit Card Specific Utilization & Limit Bar */}
      {isCredit && creditLimit > 0 && (
        <div className="mt-3 pt-2.5 border-t border-white/[0.06] dark:border-white/[0.06] light:border-slate-200">
          <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
            <span>Utilization: <span className="font-mono-num tabular-nums font-semibold">{creditUtilizationRatio}%</span></span>
            <span className={privacyMode ? "privacy-blur" : ""}>
              Available: <span className="font-mono-num tabular-nums">{formatCurrency(availableCredit, account.currency, "id-ID")}</span>
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/[0.05] dark:bg-white/[0.05] light:bg-slate-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                creditUtilizationRatio > 75
                  ? "bg-rose-500"
                  : creditUtilizationRatio > 40
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${creditUtilizationRatio}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-[var(--text-muted)] mt-1">
            <span>Limit: <span className="font-mono-num tabular-nums">{formatCurrency(creditLimit, account.currency, "id-ID")}</span></span>
          </div>
        </div>
      )}
    </div>
  );
};
