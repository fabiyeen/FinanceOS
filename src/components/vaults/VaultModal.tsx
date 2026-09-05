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
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto pb-[env(safe-area-inset-bottom)]"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col rounded-xl border border-[#232A3B] bg-[#0F131C] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#232A3B] bg-[#07090E] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#00F0FF]" />
            <h2 className="text-xs sm:text-sm font-mono-num font-bold tracking-wider text-white uppercase">
              {targetVault ? `Update Vault: ${targetVault.title}` : "Create Capital Sinking Vault"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-md hover:bg-[#161B26] transition-colors"
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
            <div className="p-3 text-xs font-mono-num border border-red-500/50 bg-red-950/30 text-red-400 rounded-md">
              {errorMsg}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-[11px] font-mono-num uppercase tracking-wider text-zinc-400 mb-1.5">
              Vault Goal Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Shibuya Tech Lab Gear, Emergency Runway, Tokyo Trip"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#07090E] border border-[#232A3B] focus:border-[#00F0FF] rounded-md text-white placeholder:text-zinc-600 outline-none transition-colors font-mono-num"
            />
          </div>

          {/* Target Amount */}
          <div>
            <label className="block text-[11px] font-mono-num uppercase tracking-wider text-zinc-400 mb-1.5">
              Target Allocation Amount ({currency})
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                required
                placeholder="0"
                value={targetAmountRaw ? Number(targetAmountRaw).toLocaleString("id-ID") : ""}
                onChange={handleAmountChange}
                className="w-full px-3 py-2 text-sm bg-[#07090E] border border-[#232A3B] focus:border-[#00F0FF] rounded-md text-white placeholder:text-zinc-600 outline-none transition-colors font-mono-num"
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
              <label className="block text-[11px] font-mono-num uppercase tracking-wider text-zinc-400 mb-1.5">
                Primary Liquid Backing Wallet
              </label>
              <select
                value={assignedAccountId}
                onChange={(e) => setAssignedAccountId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#07090E] border border-[#232A3B] focus:border-[#00F0FF] rounded-md text-white outline-none transition-colors font-mono-num"
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
              <label className="block text-[11px] font-mono-num uppercase tracking-wider text-zinc-400 mb-1.5">
                Target Deadline Date (Optional)
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#07090E] border border-[#232A3B] focus:border-[#00F0FF] rounded-md text-white outline-none transition-colors font-mono-num"
              />
            </div>
          </div>

          {/* Accent Color Chips */}
          <div>
            <label className="block text-[11px] font-mono-num uppercase tracking-wider text-zinc-400 mb-2">
              Vault Accent Color
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
                    className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${
                      isSelected
                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#0F131C] scale-110"
                        : "opacity-80 hover:opacity-100 hover:scale-105"
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Icon Identity Picker */}
          <div>
            <label className="block text-[11px] font-mono-num uppercase tracking-wider text-zinc-400 mb-2">
              Icon Identity
            </label>
            <div className="grid grid-cols-6 gap-2 p-3 bg-[#07090E] border border-[#232A3B] rounded-lg">
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
                    className={`p-2.5 rounded-md flex items-center justify-center transition-all ${
                      isSelected
                        ? "border border-[#00F0FF] bg-[#00F0FF]/15 text-[#00F0FF] shadow-[0_0_10px_rgba(0,240,255,0.2)]"
                        : "border border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-[#161B26]"
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Danger Zone: Delete or Liquidate Vault for existing vaults */}
          {targetVault && (
            <div className="border-t border-[#232A3B] pt-4 mt-2">
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 text-xs text-[#FF0055] hover:text-[#FF3377] transition-colors font-mono-num"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>
                    {targetVault.currentAmount > 0
                      ? "LIQUIDATE & DELETE VAULT"
                      : "DELETE CAPITAL SINKING VAULT"}
                  </span>
                </button>
              ) : (
                <div className="rounded border border-[#FF0055]/40 bg-[#FF0055]/10 p-3 space-y-3 animate-in fade-in duration-150">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[#FF0055] font-mono-num">
                      CONFIRM VAULT DESTRUCTION
                    </p>
                    {targetVault.currentAmount > 0 ? (
                      <p className="text-[11px] text-[#94A3B8] font-mono-num">
                        This vault holds{" "}
                        <strong className="text-white">
                          {formatCurrency(targetVault.currentAmount, currency, locale)}
                        </strong>
                        . Select an account to receive the refunded balance upon closure:
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#94A3B8] font-mono-num">
                        Are you sure you want to delete this vault? This action cannot be undone.
                      </p>
                    )}
                  </div>

                  {targetVault.currentAmount > 0 && (
                    <div>
                      <label className="block text-[10px] font-mono-num uppercase text-[#64748B] mb-1">
                        Refund Destination Account
                      </label>
                      <select
                        value={liquidationTargetAccountId}
                        onChange={(e) => setLiquidationTargetAccountId(e.target.value)}
                        className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-1.5 text-xs text-white focus:border-[#FF0055] focus:outline-none font-mono-num"
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
                      className="flex-1 rounded border border-[#FF0055] bg-[#FF0055]/20 py-1.5 text-xs font-mono-num font-bold text-[#FF0055] hover:bg-[#FF0055]/30 transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? "PROCESSING..." : "CONFIRM PURGE"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="rounded border border-[#232A3B] bg-[#07090E] px-3 py-1.5 text-xs text-[#94A3B8] hover:text-white"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Sticky Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#232A3B] bg-[#07090E] flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-mono-num tracking-wider uppercase text-zinc-400 hover:text-white rounded-md hover:bg-[#161B26] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="vault-form"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 text-xs font-mono-num font-bold tracking-wider uppercase bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF] hover:bg-[#00F0FF] hover:text-black rounded-md transition-all disabled:opacity-50 shadow-[0_0_12px_rgba(0,240,255,0.2)]"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            {isSubmitting ? "COMMITTING..." : targetVault ? "UPDATE VAULT" : "CREATE VAULT"}
          </button>
        </div>
      </div>
    </div>
  );
}
