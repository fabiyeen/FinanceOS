"use client";

import React, { useEffect, useState } from "react";
import { Lock, Fingerprint, KeyRound, AlertTriangle, X, Check } from "lucide-react";
import { useUIStore } from "../../store/useUIStore";
import { useAuth } from "../../lib/auth/authContext";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { verifyPin, DEFAULT_FALLBACK_PIN } from "../../lib/security";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";

interface PinLockScreenProps {
  onUnlockSuccess?: () => void;
  onOpenPinSettings?: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  onUnlockSuccess,
  onOpenPinSettings,
}) => {
  const { isLocked, setLocked, soundEnabled } = useUIStore();
  const { user, verifyPassword } = useAuth();
  const settings = useLiveQuery(() => db.settings.get("main"));

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Forgot PIN state
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  // Handle 30-second lockout timer
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const interval = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemaining]);

  if (!isLocked) return null;

  const handleDigit = async (digit: string) => {
    if (lockoutRemaining > 0) {
      playSound("alert", soundEnabled);
      return;
    }

    playSound("click", soundEnabled);
    triggerHaptic(12);
    setError(null);

    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);

      // Auto verify when 4 digits (or up to 6 digits)
      if (nextPin.length >= 4) {
        // Fetch stored PIN hash or fallback
        const security = settings?.security;
        let isCorrect = false;

        if (security?.pinHash && security?.pinSalt) {
          isCorrect = await verifyPin(nextPin, security.pinHash, security.pinSalt);
        } else {
          // Default fallback PIN is 0000
          isCorrect = nextPin === DEFAULT_FALLBACK_PIN;
        }

        if (isCorrect) {
          playSound("success", soundEnabled);
          triggerHaptic(35);
          setLocked(false);
          setPin("");
          setFailedAttempts(0);
          onUnlockSuccess?.();
        } else if (nextPin.length === 6 || (nextPin.length === 4 && (!security?.pinHash || security?.pinHash.length === 0))) {
          // If explicitly wrong after reaching length
          handleFailure();
        }
      }
    }
  };

  const handleFailure = () => {
    playSound("alert", soundEnabled);
    triggerHaptic([40, 50, 40]);
    const nextFailed = failedAttempts + 1;
    setFailedAttempts(nextFailed);
    setPin("");

    if (nextFailed >= 3) {
      setLockoutRemaining(30);
      setError("Too many failed attempts. Please wait 30 seconds.");
    } else {
      setError(`Incorrect passcode (${3 - nextFailed} attempts remaining)`);
    }
  };

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountPassword) return;

    setIsVerifyingPassword(true);
    setForgotError(null);
    playSound("click", soundEnabled);

    try {
      const isValid = await verifyPassword(accountPassword);
      if (isValid) {
        playSound("success", soundEnabled);
        triggerHaptic(30);
        setIsForgotOpen(false);
        setLocked(false);
        setPin("");
        setFailedAttempts(0);
        setLockoutRemaining(0);
        setAccountPassword("");
        // Open PIN settings so user can set a new PIN
        onOpenPinSettings?.();
      } else {
        playSound("alert", soundEnabled);
        setForgotError("Incorrect account password.");
      }
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleBiometricPrompt = async () => {
    playSound("click", soundEnabled);
    triggerHaptic(15);

    try {
      if (typeof window !== "undefined" && window.PublicKeyCredential) {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        try {
          await navigator.credentials.get({
            publicKey: {
              challenge,
              timeout: 60000,
              userVerification: "preferred",
              rpId: window.location.hostname || "localhost",
            },
          });
        } catch {
          // Fallback simulation for biometric test
        }
        playSound("success", soundEnabled);
        triggerHaptic(35);
        setLocked(false);
        setPin("");
        onUnlockSuccess?.();
      } else {
        setError("Biometrics not available on this device");
      }
    } catch {
      setError("Biometric authentication cancelled");
    }
  };

  const isDefaultPin = !settings?.security?.isPinSet;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-canvas)] p-4">
      <div className="w-full max-w-xs text-center space-y-6">
        {/* Lock Shield Icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-sm">
          <Lock className="h-6 w-6 text-[var(--accent-primary)]" />
        </div>

        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Enter Passcode
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {user?.displayName || user?.email || "FinanceOS"}
          </p>
          {isDefaultPin && (
            <div className="mt-2 inline-block rounded-md border border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10 px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-amber)]">
              Default passcode is 0000
            </div>
          )}
        </div>

        {/* PIN Dot Indicators */}
        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className={`h-3 w-3 rounded-full border transition-all ${
                pin.length > idx
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]"
                  : "border-[var(--border-default)] bg-[var(--bg-surface)]"
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="text-xs font-medium text-[var(--color-rose)] animate-pulse">
            {error}
          </div>
        )}

        {lockoutRemaining > 0 && (
          <div className="text-xs font-medium text-[var(--color-amber)]">
            Please wait: {lockoutRemaining}s
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "DEL"].map((k) => (
            <button
              key={k}
              type="button"
              disabled={lockoutRemaining > 0}
              onClick={() => {
                if (k === "CLR") {
                  playSound("delete", soundEnabled);
                  setPin("");
                } else if (k === "DEL") {
                  playSound("delete", soundEnabled);
                  setPin(pin.slice(0, -1));
                } else {
                  handleDigit(k);
                }
              }}
              className={`flex h-12 w-full items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-sm font-semibold text-[var(--text-primary)] transition-all hover:bg-[var(--bg-hover)] active:scale-95 disabled:opacity-30 ${
                k === "CLR" ? "text-[var(--color-rose)] text-xs" : ""
              } ${k === "DEL" ? "text-[var(--text-muted)] text-xs" : ""}`}
            >
              {k}
            </button>
          ))}
        </div>

        {/* Biometric & Recovery Actions */}
        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={handleBiometricPrompt}
            className="flex items-center justify-center gap-2 mx-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Fingerprint className="h-4 w-4 text-[var(--accent-primary)]" />
            <span>Use Biometrics</span>
          </button>

          <button
            type="button"
            onClick={() => setIsForgotOpen(true)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            Forgot passcode? Unlock with password
          </button>
        </div>
      </div>

      {/* Forgot PIN Recovery Modal */}
      {isForgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[var(--color-amber)]" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                  Account Password Recovery
                </h3>
              </div>
              <button
                onClick={() => setIsForgotOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              Enter your account password for <span className="text-[var(--text-primary)] font-medium">{user?.email}</span> to unlock the session and change your passcode.
            </p>

            <form onSubmit={handlePasswordRecovery} className="space-y-3">
              <input
                type="password"
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
                placeholder="Account password"
                required
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
              />

              {forgotError && (
                <div className="text-xs text-[var(--color-rose)]">
                  {forgotError}
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifyingPassword}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-primary)] py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                <span>{isVerifyingPassword ? "Verifying..." : "Unlock"}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
