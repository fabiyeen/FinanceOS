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
  // If balance is negative (-4,250,000), we owe 4,250,000
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
    <div className="industrial-card rounded-lg border border-[#232A3B] bg-[#0F131C] p-4 relative overflow-hidden group hover:border-[#384259] transition-all">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Priority Reordering Controls */}
          {(onMoveUp || onMoveDown) && (
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={!canMoveUp}
                className="p-1 rounded text-[#64748B] hover:text-[#00F0FF] hover:bg-[#161B26] disabled:opacity-20 disabled:hover:bg-transparent"
                title="Move Wallet Priority Up"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={!canMoveDown}
                className="p-1 rounded text-[#64748B] hover:text-[#00F0FF] hover:bg-[#161B26] disabled:opacity-20 disabled:hover:bg-transparent"
                title="Move Wallet Priority Down"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </div>
          )}

          <div
            className="flex h-9 w-9 items-center justify-center rounded border border-[#232A3B] bg-[#07090E]"
            style={{ color: account.color }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-semibold text-white">{account.name}</h4>
              <span className="rounded bg-[#1E2536] border border-[#232A3B] px-1.5 py-0.2 text-[9px] font-mono-num uppercase text-[#94A3B8]">
                {account.type}
              </span>
            </div>
            <div className="text-[10px] font-mono-num text-[#64748B] mt-0.5">
              CURRENCY: {account.currency}
            </div>
          </div>
        </div>

        {/* Actions: Edit & Quick Transfer */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleEditAccount}
            className="rounded border border-[#232A3B] bg-[#07090E] p-1.5 text-[#64748B] hover:text-white hover:border-[#384259] transition-colors"
            title="Configure account settings"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleQuickTransfer}
            className="rounded border border-[#232A3B] bg-[#07090E] p-1.5 text-[#64748B] hover:text-[#00F0FF] hover:border-[#00F0FF]/40 transition-colors"
            title="Initiate transfer from this account"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Balance Readout */}
      <div className="mt-4 pt-3 border-t border-[#232A3B]/60 flex items-end justify-between">
        <div>
          <span className="text-[9px] font-mono-num uppercase tracking-wider text-[#64748B]">
            {isCredit ? "CURRENT BALANCE OWED" : "AVAILABLE BALANCE"}
          </span>
          <div
            className={`font-mono-num text-base sm:text-lg font-bold tracking-tight transition-all ${
              privacyMode ? "privacy-blur" : ""
            } ${
              isCredit
                ? balanceOwed > 0
                  ? "text-[#FF5C00]"
                  : "text-[#00FF88]"
                : account.currentBalance >= 0
                ? "text-white"
                : "text-[#FF5C00]"
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
            <span className="text-[9px] font-mono-num uppercase tracking-wider text-[#64748B]">
              STATEMENT
            </span>
            <div className="text-[11px] font-mono-num text-[#FFB800]">
              Day {account.statementClosingDay}
            </div>
          </div>
        )}
      </div>

      {/* Credit Card Specific Utilization & Limit Bar */}
      {isCredit && creditLimit > 0 && (
        <div className="mt-3 pt-2 border-t border-[#232A3B]/40">
          <div className="flex justify-between text-[10px] font-mono-num text-[#94A3B8] mb-1">
            <span>Utilization: {creditUtilizationRatio}%</span>
            <span className={privacyMode ? "privacy-blur" : ""}>
              Headroom: {formatCurrency(availableCredit, account.currency, "id-ID")}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#161B26] overflow-hidden">
            <div
              className={`h-full transition-all ${
                creditUtilizationRatio > 75
                  ? "bg-[#FF5C00]"
                  : creditUtilizationRatio > 40
                  ? "bg-[#FFB800]"
                  : "bg-[#00FF88]"
              }`}
              style={{ width: `${creditUtilizationRatio}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-mono-num text-[#64748B] mt-1">
            <span>Limit: {formatCurrency(creditLimit, account.currency, "id-ID")}</span>
          </div>
        </div>
      )}
    </div>
  );
};
