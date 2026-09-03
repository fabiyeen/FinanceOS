"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Check,
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
  AlertTriangle,
  ArrowUpLeft,
} from "lucide-react";
import { Vault, Account } from "../../lib/types";
import { formatCurrency } from "../../lib/mathEngine";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "../../lib/auth/authContext";
import { getFirebaseServices } from "../../lib/firebase/config";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { addTransactionWithLedgerSync } from "../../lib/db/syncEngine";

export const VAULT_ICONS: Record<string, React.ElementType> = {
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

export const VAULT_COLORS = [
  "#00F0FF", // Cyan
  "#00FF88", // Emerald
  "#FF5C00", // Neon Flame
  "#FFB800", // Amber
  "#9D00FF", // Purple
  "#38BDF8", // Sky
  "#E056FD", // Neon Pink
];

interface VaultModalProps {
  isOpen: boolean;
  vaultToEdit: Vault | null;
  onClose: () => void;
}

export const VaultModal: React.FC<VaultModalProps> = ({
  isOpen,
  vaultToEdit,
  onClose,
}) => {
  const { user } = useAuth();
  const overlayRef = useRef<HTMLDivElement>(null);

  const rawAccounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.get("main"));

  const currency = settings?.currency || "IDR";
  const locale = settings?.locale || "id-ID";

  const liquidAccounts = rawAccounts.filter((a) => !a.isArchived && a.type !== "credit");

  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [assignedAccountId, setAssignedAccountId] = useState("");
  const [color, setColor] = useState("#00F0FF");
  const [icon, setIcon] = useState("Shield");
  const [status, setStatus] = useState<"active" | "reached" | "liquidated">("active");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Liquidation / Delete flow states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [liquidationTargetAccountId, setLiquidationTargetAccountId] = useState("");

  // Universal Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playSound("click", true);
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Sync state on open/edit
  useEffect(() => {
    if (isOpen) {
      if (vaultToEdit) {
        setTitle(vaultToEdit.title);
        setTargetAmount(String(vaultToEdit.targetAmount));
        setTargetDate(vaultToEdit.targetDate || "");
        setAssignedAccountId(vaultToEdit.assignedAccountId || liquidAccounts[0]?.id || "");
        setColor(vaultToEdit.color || "#00F0FF");
        setIcon(vaultToEdit.icon || "Shield");
        setStatus(vaultToEdit.status);
        setLiquidationTargetAccountId(vaultToEdit.assignedAccountId || liquidAccounts[0]?.id || "");
      } else {
        setTitle("");
        setTargetAmount("");
        setTargetDate("");
        setAssignedAccountId(liquidAccounts[0]?.id || "");
        setColor("#00F0FF");
        setIcon("Shield");
        setStatus("active");
        setLiquidationTargetAccountId(liquidAccounts[0]?.id || "");
      }
      setError(null);
      setShowDeleteConfirm(false);
    }
  }, [isOpen, vaultToEdit, liquidAccounts]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) {
      playSound("click", true);
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedTarget = Math.abs(parseFloat(targetAmount));

    if (!title.trim()) {
      setError("Vault goal title is required");
      return;
    }
    if (!parsedTarget || isNaN(parsedTarget) || parsedTarget <= 0) {
      setError("Please specify a target monetary amount");
      return;
    }
    if (!assignedAccountId) {
      setError("Primary funding account is required");
      return;
    }

    setIsSubmitting(true);
    playSound("click", true);
    triggerHaptic(20);

    const { firestore } = getFirebaseServices();

    try {
      if (vaultToEdit) {
        // Update existing vault
        const updated: Vault = {
          ...vaultToEdit,
          title: title.trim(),
          targetAmount: parsedTarget,
          targetDate: targetDate || undefined,
          assignedAccountId,
          color,
          icon,
          status:
            vaultToEdit.currentAmount >= parsedTarget
              ? "reached"
              : status === "reached"
              ? "active"
              : status,
        };

        await db.vaults.put(updated);

        if (firestore && user?.uid && !user.isDemo) {
          try {
            await setDoc(doc(firestore, `users/${user.uid}/vaults/${updated.id}`), updated, { merge: true });
          } catch (err) {
            console.warn("[VaultModal] Cloud sync error:", err);
          }
        }
      } else {
        // Create new vault
        const existingVaults = await db.vaults.toArray();
        const newVault: Vault = {
          id: `vault_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          title: title.trim(),
          targetAmount: parsedTarget,
          currentAmount: 0,
          targetDate: targetDate || undefined,
          assignedAccountId,
          color,
          icon,
          status: "active",
          order: existingVaults.length,
        };

        await db.vaults.add(newVault);

        if (firestore && user?.uid && !user.isDemo) {
          try {
            await setDoc(doc(firestore, `users/${user.uid}/vaults/${newVault.id}`), newVault);
          } catch (err) {
            console.warn("[VaultModal] Cloud sync error:", err);
          }
        }
      }

      playSound("success", true);
      onClose();
    } catch (err) {
      console.error("[VaultModal] Error saving vault:", err);
      setError("Failed to save vault goal");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLiquidateAndDelete = async () => {
    if (!vaultToEdit) return;
    setIsSubmitting(true);
    playSound("click", true);

    const { firestore } = getFirebaseServices();

    try {
      if (vaultToEdit.currentAmount > 0) {
        if (!liquidationTargetAccountId) {
          setError("Please select a target liquid account to receive remaining funds");
          setIsSubmitting(false);
          return;
        }

        // Create vault withdrawal transaction to transfer out remaining balance
        const today = new Date().toISOString().split("T")[0];
        const hours = String(new Date().getHours()).padStart(2, "0");
        const minutes = String(new Date().getMinutes()).padStart(2, "0");

        await addTransactionWithLedgerSync({
          desc: `Liquidation Return [${vaultToEdit.title}]`,
          amount: vaultToEdit.currentAmount,
          type: "vault_withdraw",
          fromAccountId: vaultToEdit.assignedAccountId,
          toAccountId: liquidationTargetAccountId,
          vaultId: vaultToEdit.id,
          categoryId: "cat_transfer",
          tags: ["VaultLiquidation"],
          date: today,
          time: `${hours}:${minutes}`,
          note: `Final liquidation and vault closure`,
          source: "web_client",
        });
      }

      // Delete from Dexie
      await db.vaults.delete(vaultToEdit.id);

      // Delete from Firestore
      if (firestore && user?.uid && !user.isDemo) {
        await deleteDoc(doc(firestore, `users/${user.uid}/vaults/${vaultToEdit.id}`));
      }

      playSound("delete", true);
      onClose();
    } catch (err) {
      console.error("[VaultModal] Liquidation error:", err);
      setError("Failed to liquidate and delete vault");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-6 overflow-hidden pb-[env(safe-area-inset-bottom)]"
    >
      <div
        className="w-full max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col rounded-xl border border-[#232A3B] bg-[#0F131C] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="flex-shrink-0 flex items-center justify-between border-b border-[#232A3B] px-4 py-3 bg-[#07090E]">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#00F0FF]" />
            <h3 className="font-mono-num text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
              {vaultToEdit ? `Configure Vault: ${vaultToEdit.title}` : "Create Capital Sinking Vault"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              playSound("click", true);
              onClose();
            }}
            className="text-[#64748B] hover:text-white p-1 rounded hover:bg-[#161B26]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {/* Vault Title */}
            <div>
              <label htmlFor="vault-title-input" className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                Vault Goal Title
              </label>
              <input
                id="vault-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Shibuya Tech Lab Gear, Emergency Runway, Tokyo Trip"
                required
                autoFocus
                autoComplete="off"
                className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white placeholder-[#475569] focus:border-[#00F0FF] focus:outline-none font-mono-num"
              />
            </div>

            {/* Target Amount */}
            <div>
              <label htmlFor="vault-target-amount-input" className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                Target Allocation Amount ({currency})
              </label>
              <div className="relative">
                <input
                  id="vault-target-amount-input"
                  type="number"
                  step="any"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="0"
                  required
                  autoComplete="off"
                  className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2.5 font-mono-num text-lg font-bold text-white placeholder-[#475569] focus:border-[#00F0FF] focus:outline-none"
                />
                {targetAmount && (
                  <span className="absolute right-3 top-3 text-xs font-mono-num text-[#94A3B8]">
                    {formatCurrency(parseFloat(targetAmount) || 0, currency, locale)}
                  </span>
                )}
              </div>
            </div>

            {/* Primary Backing Account & Target Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                  Primary Liquid Backing Wallet
                </label>
                <select
                  value={assignedAccountId}
                  onChange={(e) => setAssignedAccountId(e.target.value)}
                  className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                >
                  {liquidAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatCurrency(acc.currentBalance, acc.currency, locale)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                  Target Deadline Date (Optional)
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num"
                />
              </div>
            </div>

            {/* If Editing: Current Progress Status */}
            {vaultToEdit && (
              <div className="p-3 rounded bg-[#07090E] border border-[#232A3B] space-y-1">
                <div className="flex justify-between text-xs font-mono-num">
                  <span className="text-[#64748B]">Current Funded Level:</span>
                  <span className="text-[#00FF88] font-bold">
                    {formatCurrency(vaultToEdit.currentAmount, currency, locale)} (
                    {vaultToEdit.targetAmount > 0
                      ? ((vaultToEdit.currentAmount / vaultToEdit.targetAmount) * 100).toFixed(1)
                      : 0}
                    %)
                  </span>
                </div>
              </div>
            )}

            {/* Color Palette Chips */}
            <div>
              <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1.5">
                Vault Accent Color
              </label>
              <div className="flex flex-wrap gap-2">
                {VAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-6 w-6 rounded-full border-2 transition-transform ${
                      color === c ? "scale-125 border-white" : "border-transparent hover:scale-110"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Icon Picker */}
            <div>
              <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1.5">
                Icon Identity
              </label>
              <div className="grid grid-cols-6 gap-2 p-2 rounded bg-[#07090E] border border-[#232A3B]">
                {Object.keys(VAULT_ICONS).map((iconKey) => {
                  const IconComp = VAULT_ICONS[iconKey];
                  const isSelected = icon === iconKey;
                  return (
                    <button
                      key={iconKey}
                      type="button"
                      onClick={() => setIcon(iconKey)}
                      className={`flex items-center justify-center p-2 rounded border transition-colors ${
                        isSelected
                          ? "border-[#00F0FF] bg-[#00F0FF]/20 text-[#00F0FF]"
                          : "border-transparent text-[#64748B] hover:text-white hover:bg-[#161B26]"
                      }`}
                    >
                      <IconComp className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="rounded border border-[#FF0055]/40 bg-[#FF0055]/10 p-2 text-xs font-mono-num text-[#FF0055]">
                [ERROR]: {error}
              </div>
            )}

            {/* Vault Liquidation / Deletion flow */}
            {vaultToEdit && (
              <div className="pt-2 border-t border-[#232A3B]">
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-xs font-mono-num text-[#FF5C00] hover:underline flex items-center gap-1"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Liquidate or Expunge Vault
                  </button>
                ) : (
                  <div className="p-3 rounded bg-[#FF5C00]/10 border border-[#FF5C00]/30 space-y-3">
                    <p className="text-xs text-[#94A3B8] font-mono-num">
                      {vaultToEdit.currentAmount > 0 ? (
                        <>
                          Warning: Vault holds{" "}
                          <span className="text-[#00FF88] font-bold">
                            {formatCurrency(vaultToEdit.currentAmount, currency, locale)}
                          </span>
                          . Confirming liquidation will automatically withdraw this amount back to your chosen account.
                        </>
                      ) : (
                        "Vault holds zero funds and can be immediately expunged."
                      )}
                    </p>

                    {vaultToEdit.currentAmount > 0 && (
                      <div>
                        <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                          Destination Account to Receive Remaining Funds:
                        </label>
                        <select
                          value={liquidationTargetAccountId}
                          onChange={(e) => setLiquidationTargetAccountId(e.target.value)}
                          className="w-full rounded border border-[#232A3B] bg-[#07090E] px-2.5 py-1.5 text-xs text-white font-mono-num"
                        >
                          {liquidAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} ({formatCurrency(acc.currentBalance, acc.currency, locale)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-1.5 rounded border border-[#232A3B] bg-[#161B26] text-xs font-mono-num text-[#94A3B8]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleLiquidateAndDelete}
                        disabled={isSubmitting}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded border border-[#FF0055] bg-[#FF0055]/20 text-xs font-mono-num text-[#FF0055] font-bold"
                      >
                        <ArrowUpLeft className="h-3.5 w-3.5" />
                        <span>Confirm Liquidation &amp; Expunge</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="flex-shrink-0 border-t border-[#232A3B] px-4 py-3 bg-[#07090E] flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded border border-[#232A3B] bg-[#161B26] py-2 text-xs font-mono-num text-[#94A3B8] hover:text-white"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-1.5 rounded border border-[#00F0FF]/60 bg-[#00F0FF]/15 py-2 text-xs font-bold font-mono-num text-[#00F0FF] hover:bg-[#00F0FF]/25 shadow-[0_0_12px_rgba(0,240,255,0.2)] disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              <span>{vaultToEdit ? "UPDATE VAULT" : "CREATE VAULT"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
