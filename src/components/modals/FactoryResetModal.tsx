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

    if (confirmKeyword.trim() !== "PURGE-ALL") {
      setError("You must type exactly 'PURGE-ALL' to confirm destruction");
      playSound("alert", soundEnabled);
      return;
    }

    if (!pin) {
      setError("Master PIN is required to authorize factory reset");
      playSound("alert", soundEnabled);
      return;
    }

    // Verify PIN
    const security = settings?.security;
    const isCorrectPin = security?.pinHash && security?.pinSalt
      ? await verifyPin(pin, security.pinHash, security.pinSalt)
      : pin === DEFAULT_FALLBACK_PIN;

    if (!isCorrectPin) {
      setError("PIN authorization rejected: Incorrect master PIN");
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
      alert("Nuclear factory reset complete: All ledger data purged. Baseline reseeded.");
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-4 overflow-hidden pb-[env(safe-area-inset-bottom)]"
    >
      <div
        className="w-full max-w-md max-h-[calc(100dvh-2rem)] flex flex-col rounded-xl border-2 border-[#FF5C00] bg-[#0F131C] shadow-[0_0_50px_rgba(255,92,0,0.3)] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Caution Sticky Header */}
        <div className="flex-shrink-0 flex items-center justify-between border-b border-[#FF5C00]/40 px-4 py-3 bg-[#FF5C00]/10">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-[#FF5C00] animate-pulse" />
            <h3 className="font-mono-num text-xs font-bold uppercase tracking-wider text-[#FF5C00]">
              NUCLEAR LEDGER FACTORY RESET
            </h3>
          </div>
          <button
            onClick={() => {
              playSound("click", soundEnabled);
              onClose();
            }}
            className="text-[#94A3B8] hover:text-white p-1 rounded hover:bg-[#161B26]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleExecuteWipe} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <div className="rounded border border-[#FF5C00]/30 bg-[#FF5C00]/5 p-3 space-y-2 text-xs font-mono-num text-[#94A3B8]">
            <div className="flex items-center gap-1.5 text-[#FF5C00] font-bold">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>IRREVERSIBLE DESTRUCTION WARNING</span>
            </div>
            <p>
              This will permanently purge all transactions, accounts, debts, recurring schedules, and sinking vaults from both local IndexedDB and Cloud Firestore.
            </p>
            <p className="text-white font-semibold">
              Your login identity and security PIN will be preserved. Baseline zero-balance accounts will be reseeded.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
              Step 1: Type <span className="text-[#FF5C00] font-bold">PURGE-ALL</span> to confirm
            </label>
            <input
              type="text"
              value={confirmKeyword}
              onChange={(e) => setConfirmKeyword(e.target.value)}
              placeholder="PURGE-ALL"
              required
              className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white placeholder-[#475569] focus:border-[#FF5C00] focus:outline-none font-mono-num"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
              Step 2: Enter Master PIN for Authorization
            </label>
            <input
              type="password"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Master PIN"
              required
              className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white placeholder-[#475569] focus:border-[#FF5C00] focus:outline-none font-mono-num"
            />
          </div>

          {error && (
            <div className="rounded border border-[#FF0055]/40 bg-[#FF0055]/10 p-2 text-xs font-mono-num text-[#FF0055]">
              [ABORTED]: {error}
            </div>
          )}

          </div>

          {/* Sticky Footer */}
          <div className="flex-shrink-0 border-t border-[#232A3B] px-4 py-3 bg-[#07090E] flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded border border-[#232A3B] bg-[#161B26] py-2 text-xs font-mono-num text-[#94A3B8] hover:text-white transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isWiping}
              className="flex-1 flex items-center justify-center gap-1.5 rounded border border-[#FF5C00] bg-[#FF5C00]/20 py-2 text-xs font-bold font-mono-num text-[#FF5C00] hover:bg-[#FF5C00]/30 transition-all disabled:opacity-50"
            >
              <Flame className="h-4 w-4" />
              <span>{isWiping ? "PURGING..." : "EXECUTE NUCLEAR RESET"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
