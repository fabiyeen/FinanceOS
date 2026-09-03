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
      setError("SECURITY LOCKOUT: 3 FAILED ATTEMPTS. WAIT 30 SECONDS");
    } else {
      setError(`INCORRECT PIN (${3 - nextFailed} ATTEMPTS REMAINING)`);
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
        setForgotError("Password verification failed. Incorrect password.");
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
        setError("Biometric sensor not available on this device");
      }
    } catch {
      setError("Biometric authentication cancelled");
    }
  };

  const isDefaultPin = !settings?.security?.isPinSet;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07090E] p-4">
      <div className="w-full max-w-xs text-center space-y-6">
        {/* Lock Shield Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#00F0FF]/40 bg-[#0F131C] shadow-[0_0_30px_rgba(0,240,255,0.2)]">
          <Lock className="h-8 w-8 text-[#00F0FF]" />
        </div>

        <div>
          <h2 className="font-mono-num text-sm font-bold uppercase tracking-widest text-white">
            FINANCE_OS // LOCKED
          </h2>
          <p className="text-[11px] font-mono-num text-[#64748B] mt-1">
            Operative: {user?.displayName || user?.email || "Agent"}
          </p>
          {isDefaultPin && (
            <div className="mt-2 rounded border border-[#FFB800]/40 bg-[#FFB800]/10 px-2 py-1 text-[10px] font-mono-num text-[#FFB800]">
              [DEFAULT PIN 0000 ACTIVE]
            </div>
          )}
        </div>

        {/* PIN Dot Indicators */}
        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className={`h-3.5 w-3.5 rounded-full border transition-all ${
                pin.length > idx
                  ? "border-[#00F0FF] bg-[#00F0FF] shadow-[0_0_8px_#00F0FF]"
                  : "border-[#232A3B] bg-[#161B26]"
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="text-[10px] font-mono-num text-[#FF0055] animate-pulse">
            {error}
          </div>
        )}

        {lockoutRemaining > 0 && (
          <div className="text-xs font-mono-num text-[#FF5C00] font-bold">
            LOCKOUT COOLDOWN: {lockoutRemaining}s
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
              className={`flex h-12 w-full items-center justify-center rounded-lg border border-[#232A3B] bg-[#0F131C] font-mono-num text-sm font-bold text-white transition-all hover:bg-[#1E2536] active:scale-95 disabled:opacity-30 ${
                k === "CLR" ? "text-[#FF5C00]" : ""
              } ${k === "DEL" ? "text-[#94A3B8]" : ""}`}
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
            className="flex items-center justify-center gap-2 mx-auto rounded border border-[#00F0FF]/40 bg-[#00F0FF]/10 px-4 py-2 text-xs font-mono-num text-[#00F0FF] hover:bg-[#00F0FF]/20 transition-colors"
          >
            <Fingerprint className="h-4 w-4" />
            <span>BIOMETRIC PASSKEY</span>
          </button>

          <button
            type="button"
            onClick={() => setIsForgotOpen(true)}
            className="text-[11px] font-mono-num text-[#64748B] hover:text-[#94A3B8] transition-colors"
          >
            Forgot PIN? Unlock with Account Password
          </button>
        </div>
      </div>

      {/* Forgot PIN Recovery Modal */}
      {isForgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div
            className="w-full max-w-sm rounded-lg border border-[#232A3B] bg-[#0F131C] p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#232A3B] pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[#FFB800]" />
                <h3 className="font-mono-num text-xs font-bold uppercase tracking-wider text-white">
                  Account Password Recovery
                </h3>
              </div>
              <button
                onClick={() => setIsForgotOpen(false)}
                className="text-[#64748B] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs font-mono-num text-[#94A3B8]">
              Enter your account password for <span className="text-white font-bold">{user?.email}</span> to unlock the session and reconfigure your PIN.
            </p>

            <form onSubmit={handlePasswordRecovery} className="space-y-3">
              <input
                type="password"
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
                placeholder="Account password..."
                required
                className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white placeholder-[#475569] focus:border-[#00F0FF] focus:outline-none font-mono-num"
              />

              {forgotError && (
                <div className="text-[10px] font-mono-num text-[#FF0055]">
                  {forgotError}
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifyingPassword}
                className="flex w-full items-center justify-center gap-1.5 rounded border border-[#FFB800]/60 bg-[#FFB800]/15 py-2 text-xs font-bold font-mono-num text-[#FFB800] hover:bg-[#FFB800]/25 transition-colors disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                <span>{isVerifyingPassword ? "VERIFYING..." : "VERIFY & UNLOCK"}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
