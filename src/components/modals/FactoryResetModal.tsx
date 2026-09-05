"use client";

import React, { useState } from "react";
import { AlertTriangle, Flame, X, Check, ShieldAlert } from "lucide-react";
import { useAuth } from "../../lib/auth/authContext";
import { useUIStore } from "../../store/useUIStore";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { executeNuclearReset } from "../../lib/db/resetEngine";
import { verifyPin, DEFAULT_FALLBACK_PIN } from "../../lib/security";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";

interface FactoryResetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FactoryResetModal: React.FC<FactoryResetModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const { soundEnabled, setActiveTab } = useUIStore();
  const settings = useLiveQuery(() => db.settings.get("main"));

  const [confirmKeyword, setConfirmKeyword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isWiping, setIsWiping] = useState(false);

  const overlayRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playSound("click", soundEnabled);
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, soundEnabled]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) {
      playSound("click", soundEnabled);
      onClose();
    }
  };

  const handleExecuteWipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const kw = confirmKeyword.trim().toUpperCase();
    if (kw !== "RESET" && kw !== "PURGE-ALL") {
      setError("Please type 'RESET' to confirm.");
      playSound("alert", soundEnabled);
      return;
    }

    if (!pin) {
      setError("Passcode is required to authorize reset.");
      playSound("alert", soundEnabled);
      return;
    }

    // Verify PIN
    const security = settings?.security;
    const isCorrectPin = security?.pinHash && security?.pinSalt
      ? await verifyPin(pin, security.pinHash, security.pinSalt)
      : pin === DEFAULT_FALLBACK_PIN;

    if (!isCorrectPin) {
      setError("Incorrect passcode.");
      playSound("alert", soundEnabled);
      triggerHaptic([50, 60, 50]);
      return;
    }

    setIsWiping(true);
    playSound("click", soundEnabled);
    triggerHaptic(50);

    try {
      await executeNuclearReset(user?.uid || "default");
      playSound("delete", soundEnabled);
      triggerHaptic([100, 50, 100]);
      alert("All data reset. Starting accounts have been re-created.");
      setActiveTab("overview");
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to execute reset");
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-hidden"
    >
      <div
        className="w-full sm:max-w-md max-h-[92dvh] sm:max-h-[calc(100dvh-2rem)] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3 bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-[var(--color-rose)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Reset All Data
            </h3>
          </div>
          <button
            onClick={() => {
              playSound("click", soundEnabled);
              onClose();
            }}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-[var(--bg-hover)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleExecuteWipe} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            <div className="rounded-xl border border-[var(--color-rose)]/20 bg-[var(--color-rose)]/10 p-3.5 space-y-2 text-xs text-[var(--text-secondary)]">
              <div className="flex items-center gap-1.5 text-[var(--color-rose)] font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Permanent Reset Warning</span>
              </div>
              <p>
                This will permanently delete all transactions, accounts, debts, recurring schedules, and savings goals from both your local device and the cloud.
              </p>
              <p className="text-[var(--text-primary)] font-medium">
                Your login identity and security passcode will be kept. Clean baseline accounts with zero balances will be re-created.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Step 1: Type <span className="text-[var(--color-rose)] font-bold">RESET</span> to confirm
              </label>
              <input
                type="text"
                value={confirmKeyword}
                onChange={(e) => setConfirmKeyword(e.target.value)}
                placeholder="RESET"
                required
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--color-rose)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Step 2: Enter Passcode for Authorization
              </label>
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Passcode"
                required
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--color-rose)] focus:outline-none"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-[var(--color-rose)]/30 bg-[var(--color-rose)]/10 p-2 text-xs font-medium text-[var(--color-rose)]">
                {error}
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="flex-shrink-0 border-t border-[var(--border-default)] px-4 py-3 bg-[var(--bg-surface)] flex gap-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isWiping}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-rose)] py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Flame className="h-4 w-4" />
              <span>{isWiping ? "Resetting..." : "Reset All Data"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
