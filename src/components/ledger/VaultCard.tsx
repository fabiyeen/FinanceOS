"use client";

import React from "react";
import {
  Shield,
  ShieldAlert,
  Cpu,
  Mountain,
  ArrowDownRight,
  ArrowUpLeft,
  CheckCircle,
  Edit2,
  Plane,
  Car,
  Home,
  Coins,
  Zap,
  Sparkles,
  Gift,
  Laptop,
} from "lucide-react";
import confetti from "canvas-confetti";
import { Vault } from "../../lib/types";
import { formatCurrency, safeSub } from "../../lib/mathEngine";
import { useUIStore } from "../../store/useUIStore";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";

const VAULT_ICON_MAP: Record<string, React.ElementType> = {
  Shield,
  Cpu,
  ShieldAlert,
  Mountain,
  Plane,
  Car,
  Home,
  Coins,
  Zap,
  Sparkles,
  Gift,
  Laptop,
};

interface VaultCardProps {
  vault: Vault;
}

export const VaultCard: React.FC<VaultCardProps> = ({ vault }) => {
  const { privacyMode, soundEnabled, openQuickTx, openVaultModal } = useUIStore();

  const IconComp = VAULT_ICON_MAP[vault.icon] || Shield;

  const progress = vault.targetAmount > 0
    ? Math.min(100, Math.round((vault.currentAmount / vault.targetAmount) * 1000) / 10)
    : 0;

  const isReached = vault.currentAmount >= vault.targetAmount || vault.status === "reached";
  const remaining = Math.max(0, safeSub(vault.targetAmount, vault.currentAmount));

  const handleDeposit = () => {
    playSound("click", soundEnabled);
    triggerHaptic(15);
    openQuickTx({
      type: "vault_deposit",
      vaultId: vault.id,
      fromAccountId: vault.assignedAccountId,
    });
  };

  const handleWithdraw = () => {
    playSound("click", soundEnabled);
    triggerHaptic(15);
    openQuickTx({
      type: "vault_withdraw",
      vaultId: vault.id,
      toAccountId: vault.assignedAccountId,
    });
  };

  const handleEditVault = () => {
    playSound("click", soundEnabled);
    triggerHaptic(15);
    openVaultModal(vault);
  };

  const triggerCelebrate = () => {
    playSound("success", soundEnabled);
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.7 },
      colors: ["#00F0FF", "#00FF88", "#FF5C00"],
    });
  };

  return (
    <div className="industrial-card rounded-lg border border-[#232A3B] bg-[#0F131C] p-4 relative overflow-hidden group hover:border-[#384259] transition-all">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded border border-[#232A3B] bg-[#07090E]"
            style={{ color: vault.color }}
          >
            <IconComp className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-semibold text-white">{vault.title}</h4>
            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono-num text-[#64748B]">
              <span>STATUS:</span>
              <span
                className={`uppercase font-bold ${
                  isReached ? "text-[#00FF88]" : "text-[#00F0FF]"
                }`}
              >
                {vault.status}
              </span>
              {vault.targetDate && <span>• DUE {vault.targetDate}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isReached && (
            <button
              onClick={triggerCelebrate}
              className="rounded-full bg-[#00FF88]/15 border border-[#00FF88]/40 p-1 text-[#00FF88] hover:scale-110 transition-transform"
              title="Goal Reached! Click to celebrate"
            >
              <CheckCircle className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={handleEditVault}
            className="rounded border border-[#232A3B] bg-[#07090E] p-1.5 text-[#64748B] hover:text-white hover:border-[#384259] transition-colors"
            title="Configure Vault Parameters"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar & Badges */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono-num">
          <span className="text-[#94A3B8]">[ALLOCATION PROGRESS]</span>
          <span
            className={`font-bold ${
              isReached ? "text-[#00FF88]" : "text-[#00F0FF]"
            }`}
          >
            {progress.toFixed(1)}%
          </span>
        </div>

        <div className="h-2 w-full rounded-full bg-[#161B26] overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isReached
                ? "bg-[#00FF88] shadow-[0_0_8px_#00FF88]"
                : "bg-[#00F0FF] shadow-[0_0_8px_#00F0FF]"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono-num text-[#64748B] pt-0.5">
          <span className={privacyMode ? "privacy-blur" : ""}>
            Current: {formatCurrency(vault.currentAmount, "IDR", "id-ID")}
          </span>
          <span>Target: {formatCurrency(vault.targetAmount, "IDR", "id-ID")}</span>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-4 pt-3 border-t border-[#232A3B]/60 flex items-center justify-between">
        <div className="text-[10px] font-mono-num text-[#94A3B8]">
          {!isReached ? (
            <span className={privacyMode ? "privacy-blur" : ""}>
              Remaining: {formatCurrency(remaining, "IDR", "id-ID")}
            </span>
          ) : (
            <span className="text-[#00FF88]">TARGET FULLY FUNDED</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDeposit}
            className="flex items-center gap-1 rounded border border-[#232A3B] bg-[#161B26] px-2 py-1 text-[10px] font-mono-num text-[#00F0FF] hover:border-[#00F0FF]/50 transition-colors"
          >
            <ArrowDownRight className="h-3 w-3" />
            DEPOSIT
          </button>
          <button
            onClick={handleWithdraw}
            disabled={vault.currentAmount <= 0}
            className="flex items-center gap-1 rounded border border-[#232A3B] bg-[#161B26] px-2 py-1 text-[10px] font-mono-num text-[#FF5C00] hover:border-[#FF5C00]/50 transition-colors disabled:opacity-40"
          >
            <ArrowUpLeft className="h-3 w-3" />
            WITHDRAW
          </button>
        </div>
      </div>
    </div>
  );
};
