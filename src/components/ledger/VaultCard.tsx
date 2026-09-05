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
  AlertTriangle,
} from "lucide-react";
import confetti from "canvas-confetti";
import { Vault } from "../../lib/types";
import { formatCurrency, safeSub } from "../../lib/mathEngine";
import { useUIStore } from "../../store/useUIStore";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";

const VAULT_ICON_MAP: Record<string, React.ElementType> = {
  Shield,
  shield: Shield,
  Cpu,
  cpu: Cpu,
  ShieldAlert,
  alert: ShieldAlert,
  AlertTriangle,
  Mountain,
  mountain: Mountain,
  Plane,
  plane: Plane,
  Car,
  car: Car,
  Home,
  home: Home,
  Coins,
  coins: Coins,
  Zap,
  zap: Zap,
  Sparkles,
  sparkles: Sparkles,
  Gift,
  gift: Gift,
  Laptop,
  laptop: Laptop,
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
      colors: ["#00F0FF", "#10B981", "#F59E0B"],
    });
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] p-4 sm:p-5 relative overflow-hidden group hover:border-white/[0.14] transition-all shadow-xs">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200 bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-100"
            style={{ color: vault.color }}
          >
            <IconComp className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">{vault.title}</h4>
            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[var(--text-muted)]">
              <span
                className={`rounded-full px-2 py-0.2 border text-[10px] font-medium uppercase ${
                  isReached
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-white/[0.04] text-[var(--text-secondary)] border-white/[0.06]"
                }`}
              >
                {vault.status}
              </span>
              {vault.targetDate && <span className="font-mono-num">• Due {vault.targetDate}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isReached && (
            <button
              onClick={triggerCelebrate}
              className="rounded-full bg-emerald-500/15 border border-emerald-500/30 p-1 text-emerald-500 hover:scale-110 transition-transform"
              title="Goal Reached! Click to celebrate"
            >
              <CheckCircle className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={handleEditVault}
            className="rounded-lg border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200 bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-100 p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Edit Goal"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar & Badges */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-muted)]">Progress</span>
          <span
            className={`font-mono-num font-semibold tabular-nums ${
              isReached ? "text-emerald-500" : "text-[var(--text-primary)]"
            }`}
          >
            {progress.toFixed(1)}%
          </span>
        </div>

        <div className="h-2 w-full rounded-full bg-white/[0.05] dark:bg-white/[0.05] light:bg-slate-200 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              backgroundColor: vault.color || "#10B981",
            }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono-num text-[var(--text-muted)] pt-0.5 tabular-nums">
          <span className={privacyMode ? "privacy-blur" : ""}>
            Current: {formatCurrency(vault.currentAmount, "IDR", "id-ID")}
          </span>
          <span>Target: {formatCurrency(vault.targetAmount, "IDR", "id-ID")}</span>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-4 pt-3 border-t border-white/[0.06] dark:border-white/[0.06] light:border-slate-200 flex items-center justify-between">
        <div className="text-xs text-[var(--text-secondary)] font-mono-num tabular-nums">
          {!isReached ? (
            <span className={privacyMode ? "privacy-blur" : ""}>
              Remaining: {formatCurrency(remaining, "IDR", "id-ID")}
            </span>
          ) : (
            <span className="text-emerald-500 font-medium">Goal Achieved! 🎉</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDeposit}
            className="flex items-center gap-1 rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-slate-100 px-2.5 py-1 text-xs text-emerald-500 hover:border-emerald-500/50 transition-colors font-semibold"
          >
            <ArrowDownRight className="h-3.5 w-3.5" />
            <span>Deposit</span>
          </button>
          <button
            onClick={handleWithdraw}
            disabled={vault.currentAmount <= 0}
            className="flex items-center gap-1 rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-slate-100 px-2.5 py-1 text-xs text-rose-500 hover:border-rose-500/50 transition-colors disabled:opacity-30 font-semibold"
          >
            <ArrowUpLeft className="h-3.5 w-3.5" />
            <span>Withdraw</span>
          </button>
        </div>
      </div>
    </div>
  );
};
