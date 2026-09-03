"use client";

import React, { useEffect, useState } from "react";
import {
  Shield,
  ShieldOff,
  Volume2,
  VolumeX,
  Command,
  Plus,
  RefreshCw,
  Wifi,
  WifiOff,
  Lock,
  LogOut,
  User,
  AlertTriangle,
} from "lucide-react";
import { useUIStore } from "../../store/useUIStore";
import { useAuth } from "../../lib/auth/authContext";
import { formatCurrency } from "../../lib/mathEngine";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { db } from "../../lib/db/dexie";
import { drainSyncQueue } from "../../lib/db/syncEngine";
import { useLiveQuery } from "dexie-react-hooks";
import { calculateNetWorth } from "../../lib/mathEngine";
import { PinSettingsModal } from "../security/PinSettingsModal";

export const TopDock: React.FC = () => {
  const {
    privacyMode,
    togglePrivacyMode,
    soundEnabled,
    toggleSoundEnabled,
    setCmdBarOpen,
    openQuickTx,
    setLocked,
  } = useUIStore();

  const { user, signOut } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Live query sync queue count and net worth data
  const pendingCount = useLiveQuery(() => db.syncQueue.where("status").equals("pending").count()) ?? 0;
  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const vaults = useLiveQuery(() => db.vaults.toArray()) ?? [];
  const debts = useLiveQuery(() => db.debts.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.get("main"));

  const currency = settings?.currency || "IDR";
  const locale = settings?.locale || "id-ID";
  const netWorth = calculateNetWorth(accounts, vaults, debts);

  const isDefaultPin = !settings?.security?.isPinSet;

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Global keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        playSound("click", soundEnabled);
        setCmdBarOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "h") {
        e.preventDefault();
        playSound("toggle", soundEnabled);
        triggerHaptic(20);
        togglePrivacyMode();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        playSound("click", soundEnabled);
        setLocked(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [soundEnabled, togglePrivacyMode, setCmdBarOpen, setLocked]);

  const triggerSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    playSound("tab", soundEnabled);
    try {
      await drainSyncQueue();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSignOut = async () => {
    if (confirm("Disconnect and secure operative session?")) {
      playSound("click", soundEnabled);
      triggerHaptic(20);
      await signOut();
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-[#232A3B] bg-[#07090E]/90 backdrop-blur-md px-3 sm:px-6 py-2.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-4">
          {/* Left: Brand & Connection Status */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 font-mono-num text-xs sm:text-sm font-bold tracking-wider text-white">
              <span className="inline-block h-2 w-2 rounded-full bg-[#00F0FF] shadow-[0_0_8px_#00F0FF]" />
              <span className="text-[#00F0FF]">FINANCE</span>
              <span className="bg-[#161B26] px-1.5 py-0.5 text-[10px] text-[#94A3B8] border border-[#232A3B] rounded">
                OS.v2
              </span>
            </div>

            {/* Sync Status Badge */}
            <button
              onClick={triggerSync}
              title={isOnline ? "Online — click to force sync" : "Offline mode — mutations queued locally"}
              className="flex items-center gap-1.5 rounded border border-[#232A3B] bg-[#0F131C] px-2 py-1 text-[10px] font-mono-num transition-colors hover:border-[#384259]"
            >
              {isOnline ? (
                <span className="flex items-center gap-1 text-[#00FF88]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00FF88] animate-pulse" />
                  <Wifi className="h-3 w-3" />
                  <span className="hidden md:inline">SYNCED</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[#FF5C00]">
                  <WifiOff className="h-3 w-3" />
                  <span>OFFLINE</span>
                </span>
              )}

              {pendingCount > 0 && (
                <span className="flex items-center gap-0.5 rounded bg-[#FF5C00]/20 px-1 text-[9px] text-[#FF5C00] font-bold">
                  <RefreshCw className={`h-2.5 w-2.5 ${isSyncing ? "animate-spin" : ""}`} />
                  {pendingCount}
                </span>
              )}
            </button>
          </div>

          {/* Center: Live Net Worth Ticker */}
          <div className="flex items-center gap-2">
            <div className="text-right sm:text-center">
              <div className="text-[10px] uppercase tracking-widest text-[#64748B] font-mono-num flex items-center justify-center gap-1">
                <span>NET WORTH</span>
                <span className="text-[9px] text-[#00F0FF]">[LIVE]</span>
              </div>
              <div
                className={`font-mono-num text-sm sm:text-lg font-bold tracking-tight text-white transition-all ${
                  privacyMode ? "privacy-blur" : ""
                }`}
              >
                {formatCurrency(netWorth, currency, locale)}
              </div>
            </div>
          </div>

          {/* Right: User Operative Pill & Quick Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* User identity pill */}
            {user && (
              <div
                className="hidden md:flex items-center gap-1.5 rounded border border-[#232A3B] bg-[#0F131C] px-2 py-1 text-xs font-mono-num text-[#94A3B8]"
                title={`Logged in as ${user.email}`}
              >
                <User className="h-3 w-3 text-[#00F0FF]" />
                <span className="truncate max-w-[110px] text-white">
                  {user.displayName || user.email.split("@")[0]}
                </span>
              </div>
            )}

            {/* Universal Cmd Bar Trigger */}
            <button
              onClick={() => {
                playSound("click", soundEnabled);
                setCmdBarOpen(true);
              }}
              className="hidden sm:flex items-center gap-1.5 rounded border border-[#232A3B] bg-[#0F131C] px-2.5 py-1 text-xs text-[#94A3B8] hover:border-[#00F0FF]/50 hover:text-white transition-all"
              title="Open Command Bar (Cmd+K)"
            >
              <Command className="h-3.5 w-3.5 text-[#00F0FF]" />
              <span className="font-mono-num text-[11px]">CMD+K</span>
            </button>

            {/* Privacy Blinder Toggle */}
            <button
              onClick={() => {
                playSound("toggle", soundEnabled);
                triggerHaptic(15);
                togglePrivacyMode();
              }}
              className={`rounded border p-1.5 transition-colors ${
                privacyMode
                  ? "border-[#FF5C00] bg-[#FF5C00]/10 text-[#FF5C00]"
                  : "border-[#232A3B] bg-[#0F131C] text-[#94A3B8] hover:text-white"
              }`}
              title={`Toggle Privacy Blinder (${privacyMode ? "Active" : "Disabled"}) [Ctrl+H]`}
            >
              {privacyMode ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
            </button>

            {/* Sound Toggle */}
            <button
              onClick={() => {
                playSound("toggle", !soundEnabled);
                toggleSoundEnabled();
              }}
              className="hidden sm:flex rounded border border-[#232A3B] bg-[#0F131C] p-1.5 text-[#94A3B8] hover:text-white transition-colors"
              title={`Tactile Audio Feedback (${soundEnabled ? "Enabled" : "Muted"})`}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4 text-[#00FF88]" /> : <VolumeX className="h-4 w-4" />}
            </button>

            {/* Lock Session */}
            <button
              onClick={() => {
                playSound("click", soundEnabled);
                setLocked(true);
              }}
              className="rounded border border-[#232A3B] bg-[#0F131C] p-1.5 text-[#94A3B8] hover:text-white transition-colors"
              title="Lock Session (Master PIN / Biometrics) [Ctrl+L]"
            >
              <Lock className="h-4 w-4" />
            </button>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="rounded border border-[#232A3B] bg-[#0F131C] p-1.5 text-[#64748B] hover:text-[#FF5C00] hover:border-[#FF5C00]/40 transition-colors"
              title="Sign Out / Disconnect Tenant"
            >
              <LogOut className="h-4 w-4" />
            </button>

            {/* Quick Add Transaction Button */}
            <button
              onClick={() => {
                playSound("click", soundEnabled);
                triggerHaptic(20);
                openQuickTx();
              }}
              className="flex items-center gap-1 rounded border border-[#00F0FF]/50 bg-[#00F0FF]/10 px-2.5 py-1 text-xs font-semibold text-[#00F0FF] hover:bg-[#00F0FF]/20 transition-all font-mono-num"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">ENTRY</span>
            </button>
          </div>
        </div>
      </header>

      {/* Default PIN Warning Banner */}
      {isDefaultPin && (
        <div
          onClick={() => {
            playSound("click", soundEnabled);
            setIsPinModalOpen(true);
          }}
          className="w-full bg-[#FF5C00]/15 border-b border-[#FF5C00]/40 px-3 py-1.5 text-center cursor-pointer hover:bg-[#FF5C00]/25 transition-colors"
        >
          <div className="flex items-center justify-center gap-2 text-xs font-mono-num text-[#FF5C00] font-bold">
            <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />
            <span>SECURITY NOTICE: DEFAULT MASTER PIN &quot;0000&quot; ACTIVE — CLICK TO CUSTOMIZE MASTER PIN</span>
          </div>
        </div>
      )}

      {/* PIN Settings Modal */}
      <PinSettingsModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
      />
    </>
  );
};
