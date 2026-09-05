"use client";

import React, { useState, useEffect, useRef } from "react";
import { KeyRound, X, Check, ShieldCheck, AlertCircle } from "lucide-react";
import { useAuth } from "../../lib/auth/authContext";
import { useUIStore } from "../../store/useUIStore";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import {
  generateSalt,
  hashPin,
  verifyPin,
  DEFAULT_FALLBACK_PIN,
} from "../../lib/security";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { firestore } from "../../lib/firebase/config";
import { doc, setDoc } from "firebase/firestore";

interface PinSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PinSettingsModal: React.FC<PinSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, verifyPassword } = useAuth();
  const { soundEnabled } = useUIStore();
  const settings = useLiveQuery(() => db.settings.get("main"));

  const [currentPinOrPassword, setCurrentPinOrPassword] = useState("");
  const [usePasswordAuth, setUsePasswordAuth] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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

  const isPinCurrentlySet = Boolean(settings?.security?.isPinSet);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Verify Current PIN or Password
    if (isPinCurrentlySet) {
      if (!currentPinOrPassword) {
        setError("Please enter your current PIN or account password to verify identity");
        playSound("alert", soundEnabled);
        return;
      }

      if (usePasswordAuth) {
        const isPassValid = await verifyPassword(currentPinOrPassword);
        if (!isPassValid) {
          setError("Account password verification failed");
          playSound("alert", soundEnabled);
          return;
        }
      } else {
        const security = settings?.security;
        const isPinValid = security
          ? await verifyPin(currentPinOrPassword, security.pinHash, security.pinSalt)
          : currentPinOrPassword === DEFAULT_FALLBACK_PIN;

        if (!isPinValid) {
          setError("Current PIN is incorrect");
          playSound("alert", soundEnabled);
          return;
        }
      }
    }

    // 2. Validate New PIN
    if (!/^\d{4,6}$/.test(newPin)) {
      setError("New PIN must be between 4 and 6 numeric digits (0-9)");
      playSound("alert", soundEnabled);
      return;
    }

    if (newPin !== confirmPin) {
      setError("PIN confirmation does not match");
      playSound("alert", soundEnabled);
      return;
    }

    setIsSaving(true);
    playSound("click", soundEnabled);
    triggerHaptic(20);

    try {
      const salt = generateSalt();
      const hash = await hashPin(newPin, salt);

      const updatedSecurity = {
        pinHash: hash,
        pinSalt: salt,
        isPinSet: true,
        autoLockTimeoutMinutes: settings?.security?.autoLockTimeoutMinutes ?? 5,
        biometricsEnabled: settings?.security?.biometricsEnabled ?? false,
        lastUnlockedAt: Date.now(),
      };

      // 3. Update local IndexedDB
      if (settings) {
        await db.settings.put({
          ...settings,
          security: updatedSecurity,
        });
      }

      // 4. Update Firestore if user is logged in
      if (firestore && user?.uid && !user.isDemo) {
        try {
          const docRef = doc(firestore, `users/${user.uid}/settings/main`);
          await setDoc(docRef, { security: updatedSecurity }, { merge: true });
        } catch (err) {
          console.warn("[PinSettings] Firestore sync notice:", err);
        }
      }

      playSound("success", soundEnabled);
      triggerHaptic(35);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update PIN");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 overflow-hidden"
    >
      <div
        className="w-full sm:max-w-md max-h-[92dvh] sm:max-h-[calc(100dvh-2rem)] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[var(--border-subtle)] bg-[var(--card-bg)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3 bg-[var(--card-surface)]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <h3 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
              {isPinCurrentlySet ? "Change Passcode" : "Set Passcode"}
            </h3>
          </div>
          <button
            onClick={() => {
              playSound("click", soundEnabled);
              onClose();
            }}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-2 rounded-lg hover:bg-[var(--bg-surface-2)] transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {/* Current Verification Step (if PIN is already configured) */}
            {isPinCurrentlySet && (
              <div className="space-y-1.5 p-3 rounded-xl bg-[var(--card-surface)] border border-[var(--border-subtle)]">
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span className="font-medium">{usePasswordAuth ? "Account Password" : "Current Passcode"}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setUsePasswordAuth(!usePasswordAuth);
                      setCurrentPinOrPassword("");
                      setError(null);
                    }}
                    className="text-emerald-500 hover:underline text-xs"
                  >
                    {usePasswordAuth ? "Verify via Passcode" : "Verify via Password"}
                  </button>
                </div>
                <input
                  type="password"
                  maxLength={usePasswordAuth ? undefined : 6}
                  value={currentPinOrPassword}
                  onChange={(e) => setCurrentPinOrPassword(e.target.value)}
                  placeholder={usePasswordAuth ? "Enter account password..." : "Enter current 4-6 digit passcode..."}
                  required
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-void)] px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-emerald-500 focus:outline-none min-h-[44px]"
                />
              </div>
            )}

            {/* New PIN inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  New Passcode (4-6 Digits)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  required
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-emerald-500 focus:outline-none text-center font-bold tracking-widest min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Confirm Passcode
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  required
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-emerald-500 focus:outline-none text-center font-bold tracking-widest min-h-[44px]"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-500">
                {error}
              </div>
            )}
          </div>

          <div className="flex-shrink-0 border-t border-[var(--border-subtle)] px-4 py-3 bg-[var(--card-surface)]">
            <button
              type="submit"
              disabled={isSaving}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-2.5 text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-50 shadow-sm min-h-[44px]"
            >
              <Check className="h-4 w-4" />
              <span>{isSaving ? "Saving..." : "Save Passcode"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
