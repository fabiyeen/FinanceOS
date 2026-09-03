"use client";

import React, { useState } from "react";
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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-md rounded-lg border border-[#232A3B] bg-[#0F131C] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#232A3B] px-4 py-3 bg-[#07090E]">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#00F0FF]" />
            <h3 className="font-mono-num text-xs font-bold uppercase tracking-wider text-white">
              {isPinCurrentlySet ? "Configure Master Security PIN" : "Initialize Master PIN"}
            </h3>
          </div>
          <button
            onClick={() => {
              playSound("click", soundEnabled);
              onClose();
            }}
            className="text-[#64748B] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 space-y-4">
          {/* Current Verification Step (if PIN is already configured) */}
          {isPinCurrentlySet && (
            <div className="space-y-1.5 p-3 rounded bg-[#07090E] border border-[#232A3B]">
              <div className="flex items-center justify-between text-[10px] font-mono-num text-[#64748B] uppercase">
                <span>{usePasswordAuth ? "Account Password" : "Current PIN"}</span>
                <button
                  type="button"
                  onClick={() => {
                    setUsePasswordAuth(!usePasswordAuth);
                    setCurrentPinOrPassword("");
                    setError(null);
                  }}
                  className="text-[#00F0FF] hover:underline"
                >
                  {usePasswordAuth ? "Verify via Current PIN" : "Verify via Account Password"}
                </button>
              </div>
              <input
                type={usePasswordAuth ? "password" : "password"}
                maxLength={usePasswordAuth ? undefined : 6}
                value={currentPinOrPassword}
                onChange={(e) => setCurrentPinOrPassword(e.target.value)}
                placeholder={usePasswordAuth ? "Enter account password..." : "Enter current 4-6 digit PIN..."}
                required
                className="w-full rounded border border-[#232A3B] bg-[#161B26] px-3 py-2 text-xs text-white placeholder-[#475569] focus:border-[#00F0FF] focus:outline-none font-mono-num"
              />
            </div>
          )}

          {/* New PIN inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                New PIN (4-6 Digits)
              </label>
              <input
                type="password"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                required
                className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white placeholder-[#475569] focus:border-[#00F0FF] focus:outline-none font-mono-num text-center text-sm font-bold tracking-widest"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                Confirm New PIN
              </label>
              <input
                type="password"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                required
                className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white placeholder-[#475569] focus:border-[#00F0FF] focus:outline-none font-mono-num text-center text-sm font-bold tracking-widest"
              />
            </div>
          </div>

          {error && (
            <div className="rounded border border-[#FF0055]/40 bg-[#FF0055]/10 p-2 text-xs font-mono-num text-[#FF0055]">
              [ERROR]: {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-[#00F0FF]/60 bg-[#00F0FF]/15 py-2.5 text-xs font-bold font-mono-num text-[#00F0FF] hover:bg-[#00F0FF]/25 transition-all disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            <span>{isSaving ? "COMPUTING SHA-256 SALT..." : "SET MASTER PIN"}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
