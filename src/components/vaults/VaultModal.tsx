"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  Cpu,
  AlertTriangle,
  Mountain,
  Plane,
  Car,
  Home,
  Coins,
  Zap,
  Sparkles,
  Gift,
  Laptop,
  X,
  Check,
  Trash2,
} from "lucide-react";
import { Account, Vault } from "../../lib/types";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "../../lib/auth/authContext";
import { addTransactionWithLedgerSync, saveVault, deleteVault } from "../../lib/db/syncEngine";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { formatCurrency } from "../../lib/mathEngine";

// Supported Accent Colors
export const VAULT_COLORS = [
  { id: "cyan", hex: "#00F0FF", border: "border-[#00F0FF]" },
  { id: "emerald", hex: "#00FF88", border: "border-[#00FF88]" },
  { id: "orange", hex: "#FF5C00", border: "border-[#FF5C00]" },
  { id: "amber", hex: "#FFB800", border: "border-[#FFB800]" },
  { id: "purple", hex: "#A855F7", border: "border-[#A855F7]" },
  { id: "sky", hex: "#38BDF8", border: "border-[#38BDF8]" },
  { id: "pink", hex: "#EC4899", border: "border-[#EC4899]" },
];

// Available Icons
export const VAULT_ICONS = [
  { id: "shield", icon: Shield, label: "Shield" },
  { id: "cpu", icon: Cpu, label: "Cpu" },
  { id: "alert", icon: AlertTriangle, label: "Alert" },
  { id: "mountain", icon: Mountain, label: "Mountain" },
  { id: "plane", icon: Plane, label: "Plane" },
  { id: "car", icon: Car, label: "Car" },
  { id: "home", icon: Home, label: "Home" },
  { id: "coins", icon: Coins, label: "Coins" },
  { id: "zap", icon: Zap, label: "Zap" },
  { id: "sparkles", icon: Sparkles, label: "Sparkles" },
  { id: "gift", icon: Gift, label: "Gift" },
  { id: "laptop", icon: Laptop, label: "Laptop" },
];

export interface VaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (vaultData: {
    title: string;
    targetAmount: number;
    assignedAccountId: string;
    targetDate?: string;
    color: string;
    icon: string;
  }) => Promise<void> | void;
  accounts?: Account[];
  initialData?: Vault | null;
  vaultToEdit?: Vault | null; // Alias for backward compatibility
}

export function VaultModal({
  isOpen,
  onClose,
  onSubmit,
  accounts: propAccounts,
  initialData,
  vaultToEdit,
}: VaultModalProps) {
  const { user } = useAuth();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Fallback to Dexie if accounts not passed via props
  const queriedAccounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const allAccounts = propAccounts && propAccounts.length > 0 ? propAccounts : queriedAccounts;
  const liquidAccounts = allAccounts.filter((a) => !a.isArchived && a.type !== "credit");

  const settings = useLiveQuery(() => db.settings.get("main"));
  const currency = settings?.currency || "IDR";
  const locale = settings?.locale || "id-ID";

  const targetVault = initialData ?? vaultToEdit ?? null;

  // 1. Independent Local Form State
  const [title, setTitle] = useState("");
  const [targetAmountRaw, setTargetAmountRaw] = useState("");
  const [assignedAccountId, setAssignedAccountId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [selectedColor, setSelectedColor] = useState(VAULT_COLORS[0].hex);
  const [selectedIcon, setSelectedIcon] = useState(VAULT_ICONS[0].id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Liquidation / Delete flow states for editing existing vaults
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [liquidationTargetAccountId, setLiquidationTargetAccountId] = useState("");

  // 2. Hydrate or Reset Form State on Open / targetVault change
  // Note: Only depend on isOpen and targetVault?.id to prevent wiping state during typing!
  useEffect(() => {
    if (isOpen) {
      if (targetVault) {
        setTitle(targetVault.title || "");
        setTargetAmountRaw(targetVault.targetAmount ? String(targetVault.targetAmount) : "");
        setAssignedAccountId(targetVault.assignedAccountId || liquidAccounts[0]?.id || "");
        setTargetDate(targetVault.targetDate || "");
        setSelectedColor(targetVault.color || VAULT_COLORS[0].hex);
        setSelectedIcon(targetVault.icon || VAULT_ICONS[0].id);
        setLiquidationTargetAccountId(targetVault.assignedAccountId || liquidAccounts[0]?.id || "");
      } else {
        setTitle("");
        setTargetAmountRaw("");
        setAssignedAccountId(liquidAccounts[0]?.id || "");
        setTargetDate("");
        setSelectedColor(VAULT_COLORS[0].hex);
        setSelectedIcon(VAULT_ICONS[0].id);
        setLiquidationTargetAccountId(liquidAccounts[0]?.id || "");
      }
      setErrorMsg(null);
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  }, [isOpen, targetVault?.id]);

  // Fallback to first liquid account once loaded if unassigned
  useEffect(() => {
    if (isOpen && !assignedAccountId && liquidAccounts.length > 0) {
      setAssignedAccountId(liquidAccounts[0].id);
      setLiquidationTargetAccountId(liquidAccounts[0].id);
    }
  }, [isOpen, assignedAccountId, liquidAccounts]);

  // 3. Escape key dismissal listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        playSound("click", true);
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) {
      playSound("click", true);
      onClose();
    }
  };

  if (!isOpen) return null;

  // Format currency helpers - numbers only
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^0-9]/g, "");
    setTargetAmountRaw(cleaned);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const numericAmount = parseInt(targetAmountRaw, 10);
    if (!title.trim()) {
      setErrorMsg("Vault goal title is required.");
      return;
    }
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMsg("Please specify a valid target allocation amount.");
      return;
    }
    if (!assignedAccountId) {
      setErrorMsg("Please select a primary backing account.");
      return;
    }

    try {
      setIsSubmitting(true);
      playSound("click", true);

      if (onSubmit) {
        await onSubmit({
          title: title.trim(),
          targetAmount: numericAmount,
          assignedAccountId,
          targetDate: targetDate || undefined,
          color: selectedColor,
          icon: selectedIcon,
        });
      } else {
        // Direct Dexie + Firestore persistence
        if (targetVault) {
          // Update existing vault
          const updatedVault: Vault = {
            ...targetVault,
            title: title.trim(),
            targetAmount: numericAmount,
            targetDate: targetDate || undefined,
            assignedAccountId,
            color: selectedColor,
            icon: selectedIcon,
          };

          await saveVault(updatedVault, user?.uid);
        } else {
          // Create new vault
          const count = await db.vaults.count();
          const newVault: Vault = {
            id: `vault_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            title: title.trim(),
            targetAmount: numericAmount,
            currentAmount: 0,
            targetDate: targetDate || undefined,
            assignedAccountId,
            color: selectedColor,
            icon: selectedIcon,
            status: "active",
            order: count,
          };

          await saveVault(newVault, user?.uid);
        }
      }

      playSound("success", true);
      triggerHaptic(20);
      onClose();
    } catch (err: any) {
      console.error("[VaultModal] Error saving vault:", err);
      setErrorMsg(err?.message || "Failed to save vault.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLiquidateAndDelete = async () => {
    if (!targetVault) return;
    setIsSubmitting(true);
    playSound("click", true);

    try {
      if (targetVault.currentAmount > 0) {
        if (!liquidationTargetAccountId) {
          setErrorMsg("Please select a destination account to return remaining funds");
          setIsSubmitting(false);
          return;
        }

        // Return remaining funds back to liquid account
        await addTransactionWithLedgerSync({
          type: "vault_withdraw",
          amount: targetVault.currentAmount,
          fromAccountId: targetVault.assignedAccountId || liquidationTargetAccountId,
          toAccountId: liquidationTargetAccountId,
          vaultId: targetVault.id,
          categoryId: "cat_transfer",
          desc: `Vault Liquidation & Closure: ${targetVault.title}`,
          date: new Date().toISOString().slice(0, 10),
          time: new Date().toTimeString().slice(0, 5),
          tags: ["liquidation", "vault_closure"],
          source: "web_client",
        });
      }

      // Delete the vault
      await deleteVault(targetVault.id, user?.uid);

      playSound("success", true);
      triggerHaptic(20);
      onClose();
    } catch (err: any) {
      console.error("[VaultModal] Liquidation error:", err);
      setErrorMsg(err?.message || "Failed to liquidate and delete vault");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-black/70 backdrop-blur-sm overflow-hidden"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[calc(100dvh-2rem)] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[var(--border-subtle)] bg-[var(--card-bg)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--card-surface)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
              {targetVault ? `Edit Goal: ${targetVault.title}` : "New Savings Goal"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-2)] transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          id="vault-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar min-h-0"
        >
          {errorMsg && (
            <div className="p-3 text-xs border border-rose-500/40 bg-rose-500/10 text-rose-500 rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Goal Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Emergency Fund, New Laptop, Vacation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[var(--card-surface)] border border-[var(--border-subtle)] focus:border-emerald-500 rounded-xl text-[var(--text-primary)] placeholder:[var(--text-muted)] outline-none transition-colors min-h-[44px]"
            />
          </div>

          {/* Target Amount */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Target Amount ({currency})
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                required
                placeholder="0"
                value={targetAmountRaw ? Number(targetAmountRaw).toLocaleString("id-ID") : ""}
                onChange={handleAmountChange}
                className="w-full px-3.5 py-2.5 text-sm bg-[var(--card-surface)] border border-[var(--border-subtle)] focus:border-emerald-500 rounded-xl text-[var(--text-primary)] placeholder:[var(--text-muted)] outline-none transition-colors font-mono-num min-h-[44px]"
              />
              {targetAmountRaw && (
                <span className="absolute right-3 top-2 text-xs font-mono-num text-[#94A3B8]">
                  {formatCurrency(parseInt(targetAmountRaw, 10) || 0, currency, locale)}
                </span>
              )}
            </div>
          </div>

          {/* Liquid Wallet & Deadline Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Payment Account
              </label>
              <select
                value={assignedAccountId}
                onChange={(e) => setAssignedAccountId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-[var(--card-surface)] border border-[var(--border-subtle)] focus:border-emerald-500 rounded-xl text-[var(--text-primary)] outline-none transition-colors min-h-[44px]"
              >
                {liquidAccounts.length === 0 && <option value="">No Accounts Available</option>}
                {liquidAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.currentBalance, currency, locale)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Target Date (Optional)
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-[var(--card-surface)] border border-[var(--border-subtle)] focus:border-emerald-500 rounded-xl text-[var(--text-primary)] outline-none transition-colors min-h-[44px]"
              />
            </div>
          </div>

          {/* Accent Color Chips */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
              Accent Color
            </label>
            <div className="flex items-center gap-3">
              {VAULT_COLORS.map((c) => {
                const isSelected = selectedColor.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      playSound("click", true);
                      setSelectedColor(c.hex);
                    }}
                    style={{ backgroundColor: c.hex }}
                    className={`w-8 h-8 rounded-full transition-transform flex items-center justify-center min-h-[32px] min-w-[32px] ${
                      isSelected
                        ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-[var(--card-bg)] scale-110"
                        : "opacity-80 hover:opacity-100 hover:scale-105"
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Icon Picker */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
              Icon
            </label>
            <div className="grid grid-cols-6 gap-2 p-3 bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-xl">
              {VAULT_ICONS.map((item) => {
                const IconComponent = item.icon;
                const isSelected =
                  selectedIcon.toLowerCase() === item.id.toLowerCase() ||
                  selectedIcon.toLowerCase() === item.label.toLowerCase();
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      playSound("click", true);
                      setSelectedIcon(item.id);
                    }}
                    className={`p-2.5 rounded-lg flex items-center justify-center transition-all min-h-[44px] min-w-[44px] ${
                      isSelected
                        ? "border border-emerald-500 bg-emerald-500/15 text-emerald-500 font-semibold shadow-sm"
                        : "border border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-surface)]"
                    }`}
                  >
                    <IconComponent className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Delete or Liquidate Goal for existing goals */}
          {targetVault && (
            <div className="border-t border-[var(--border-subtle)] pt-4 mt-2">
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-400 transition-colors font-medium min-h-[44px]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>
                    {targetVault.currentAmount > 0
                      ? "Withdraw Funds & Delete Goal"
                      : "Delete Savings Goal"}
                  </span>
                </button>
              ) : (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 space-y-3 animate-in fade-in duration-150">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-rose-500">
                      Confirm Delete Goal
                    </p>
                    {targetVault.currentAmount > 0 ? (
                      <p className="text-xs text-[var(--text-secondary)]">
                        This goal holds{" "}
                        <strong className="text-[var(--text-primary)]">
                          {formatCurrency(targetVault.currentAmount, currency, locale)}
                        </strong>
                        . Select an account to receive the refunded balance upon closure:
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--text-secondary)]">
                        Are you sure you want to delete this savings goal? This action cannot be undone.
                      </p>
                    )}
                  </div>

                  {targetVault.currentAmount > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                        Refund Destination Account
                      </label>
                      <select
                        value={liquidationTargetAccountId}
                        onChange={(e) => setLiquidationTargetAccountId(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-rose-500 focus:outline-none min-h-[44px]"
                      >
                        {liquidAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({formatCurrency(acc.currentBalance, currency, locale)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleLiquidateAndDelete}
                      disabled={isSubmitting}
                      className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 min-h-[44px]"
                    >
                      {isSubmitting ? "Processing..." : "Delete Goal"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] min-h-[44px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Sticky Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--card-surface)] flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-surface-2)] transition-colors min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="vault-form"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 rounded-xl transition-all disabled:opacity-50 shadow-sm min-h-[44px]"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            {isSubmitting ? "Saving..." : targetVault ? "Save Changes" : "Create Goal"}
          </button>
        </div>
      </div>
    </div>
  );
}
