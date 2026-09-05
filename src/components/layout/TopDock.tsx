"use client";

import React, { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Command,
  Plus,
  RefreshCw,
  Lock,
  LogOut,
  User,
  AlertTriangle,
  Sun,
  Moon,
  Contrast,
  Laptop,
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
import { useTheme } from "../providers/ThemeProvider";
import { ThemeMode } from "../../lib/types";

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

  const { theme, effectiveTheme, setTheme } = useTheme();
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

  const cycleTheme = () => {
    playSound("click", soundEnabled);
    triggerHaptic(15);
    const order: ThemeMode[] = ["dark", "light", "midnight-oled", "system"];
    const currentIdx = order.indexOf(theme);
    const nextTheme = order[(currentIdx + 1) % order.length];
    setTheme(nextTheme);
  };

  const handleSignOut = async () => {
    if (confirm("Are you sure you want to sign out of your account?")) {
      playSound("click", soundEnabled);
      triggerHaptic(20);
      await signOut();
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-[var(--border-subtle)] bg-[var(--bg-surface-1)]/90 backdrop-blur-md px-3 sm:px-6 py-2.5 transition-colors duration-150">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-4">
          {/* Left: Brand & Connection Status */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 font-medium text-sm tracking-tight text-[var(--text-primary)]">
              <div className="h-6 w-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 font-bold text-xs">
                F
              </div>
              <span className="font-semibold tracking-tight">FinanceOS</span>
            </div>

            {/* Sync Status Badge */}
            <button
              onClick={triggerSync}
              title={isOnline ? "Online — click to force sync" : "Offline mode — changes saved locally"}
              className="flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--card-surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-industrial)]"
            >
              {isOnline ? (
                <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="hidden sm:inline">Synced</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-amber-500 font-medium">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span>Offline</span>
                </span>
              )}

              {pendingCount > 0 && (
                <span className="flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 text-[10px] text-amber-500 font-semibold">
                  <RefreshCw className={`h-2.5 w-2.5 ${isSyncing ? "animate-spin" : ""}`} />
                  {pendingCount}
                </span>
              )}
            </button>
          </div>

          {/* Center: Live Net Worth Ticker (Hidden on extra small mobile screens to prevent header wrapping) */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="text-right sm:text-center">
              <div className="text-[11px] font-medium tracking-wide text-[var(--text-muted)]">
                Net Worth
              </div>
              <div
                className={`font-mono-num text-sm sm:text-lg font-bold tracking-tight text-[var(--text-primary)] transition-all ${
                  privacyMode ? "privacy-blur" : ""
                }`}
              >
                {formatCurrency(netWorth, currency, locale)}
              </div>
            </div>
          </div>

          {/* Right: Actions & Controls */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* User identity pill */}
            {user && (
              <div
                className="hidden md:flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--card-surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
                title={`Logged in as ${user.email}`}
              >
                <User className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                <span className="truncate max-w-[120px] font-medium text-[var(--text-primary)]">
                  {user.displayName || user.email.split("@")[0]}
                </span>
              </div>
            )}

            {/* Quick Cmd Bar Trigger */}
            <button
              onClick={() => {
                playSound("click", soundEnabled);
                setCmdBarOpen(true);
              }}
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--card-surface)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-industrial)] transition-all min-h-[36px]"
              title="Search and quick actions (Cmd+K)"
            >
              <Command className="h-3.5 w-3.5" />
              <span className="font-mono-num text-[11px]">Cmd+K</span>
            </button>

            {/* Theme Switcher Button */}
            <button
              onClick={cycleTheme}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--card-surface)] p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-industrial)] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              title={`Theme: ${theme.toUpperCase()} (Click to toggle)`}
            >
              {theme === "light" ? (
                <Sun className="h-4 w-4 text-amber-500" />
              ) : theme === "midnight-oled" ? (
                <Contrast className="h-4 w-4 text-indigo-400" />
              ) : theme === "system" ? (
                <Laptop className="h-4 w-4 text-blue-400" />
              ) : (
                <Moon className="h-4 w-4 text-slate-300" />
              )}
            </button>

            {/* Privacy Blinder Toggle */}
            <button
              onClick={() => {
                playSound("toggle", soundEnabled);
                triggerHaptic(15);
                togglePrivacyMode();
              }}
              className={`rounded-lg border p-2 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${
                privacyMode
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-500"
                  : "border-[var(--border-subtle)] bg-[var(--card-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-industrial)]"
              }`}
              title={privacyMode ? "Show Balances (Ctrl+H)" : "Hide Balances (Ctrl+H)"}
            >
              {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>

            {/* Sound Toggle */}
            <button
              onClick={() => {
                playSound("toggle", !soundEnabled);
                toggleSoundEnabled();
              }}
              className="hidden sm:flex rounded-lg border border-[var(--border-subtle)] bg-[var(--card-surface)] p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-industrial)] transition-colors min-h-[36px] min-w-[36px] items-center justify-center"
              title={`Sound Effects (${soundEnabled ? "On" : "Off"})`}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-500" /> : <VolumeX className="h-4 w-4 text-[var(--text-muted)]" />}
            </button>

            {/* Lock Session */}
            <button
              onClick={() => {
                playSound("click", soundEnabled);
                setLocked(true);
              }}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--card-surface)] p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-industrial)] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="Lock Screen (Ctrl+L)"
            >
              <Lock className="h-4 w-4" />
            </button>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--card-surface)] p-2 text-[var(--text-muted)] hover:text-rose-500 hover:border-rose-500/30 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="Sign Out"
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
              className="flex items-center gap-1.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-all shadow-sm min-h-[36px]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Transaction</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>
      </header>

      {/* Default Passcode Warning Banner */}
      {isDefaultPin && (
        <div
          onClick={() => {
            playSound("click", soundEnabled);
            setIsPinModalOpen(true);
          }}
          className="w-full bg-amber-500/10 border-b border-amber-500/20 px-3 py-2 text-center cursor-pointer hover:bg-amber-500/15 transition-colors"
        >
          <div className="flex items-center justify-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Default passcode &apos;0000&apos; is active. Click to set your secure passcode.</span>
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
