"use client";

import React, { useState } from "react";
import {
  FileSpreadsheet,
  Download,
  Shield,
  Copy,
  Check,
  Code2,
  Terminal,
  KeyRound,
  Clock,
  AlertTriangle,
  Sun,
  Moon,
  Contrast,
  Laptop,
  Palette,
  Volume2,
} from "lucide-react";
import { DebtTracker } from "../ledger/DebtTracker";
import { RecurringRulesManager } from "../ledger/RecurringRulesManager";
import { PinSettingsModal } from "../security/PinSettingsModal";
import { FactoryResetModal } from "../modals/FactoryResetModal";
import { CategoryManager } from "./CategoryManager";
import { useUIStore } from "../../store/useUIStore";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useTheme } from "../providers/ThemeProvider";
import { ThemeMode } from "../../lib/types";

export const ToolsView: React.FC = () => {
  const {
    setCsvImportOpen,
    setCsvExportOpen,
    soundEnabled,
    hapticsEnabled,
    toggleHapticsEnabled,
  } = useUIStore();

  const { theme, setTheme } = useTheme();
  const settings = useLiveQuery(() => db.settings.get("main"));
  const [copiedKey, setCopiedKey] = useState(false);
  const [isPinSettingsOpen, setIsPinSettingsOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const apiKey = settings?.companionApiKey || "fos_sec_79a83f120e89b41a9c472d001";
  const isPinSet = Boolean(settings?.security?.isPinSet);
  const autoLockTimeout = settings?.security?.autoLockTimeoutMinutes ?? 5;

  const handleCopyKey = () => {
    playSound("click", soundEnabled);
    triggerHaptic(15);
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleAutoLockChange = async (timeout: number) => {
    playSound("toggle", soundEnabled);
    if (settings) {
      await db.settings.put({
        ...settings,
        security: {
          ...settings.security,
          autoLockTimeoutMinutes: timeout,
        },
      });
    }
  };

  const themes: { id: ThemeMode; label: string; desc: string; icon: React.ElementType }[] = [
    { id: "dark", label: "Dark (Slate)", desc: "Modern deep slate background", icon: Moon },
    { id: "light", label: "Light (Paper)", desc: "Clean crisp paper contrast", icon: Sun },
    { id: "midnight-oled", label: "Midnight OLED", desc: "Pure pitch black surfaces", icon: Contrast },
    { id: "system", label: "System", desc: "Syncs with your device setting", icon: Laptop },
  ];

  return (
    <div className="space-y-8">
      {/* 1. Theme & Visual Style Engine */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Appearance &amp; Theme
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {themes.map((t) => {
            const Icon = t.icon;
            const isSelected = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  playSound("click", soundEnabled);
                  triggerHaptic(15);
                  setTheme(t.id);
                }}
                className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all min-h-[44px] ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500 shadow-sm"
                    : "border-[var(--border-subtle)] bg-[var(--card-bg)] hover:border-[var(--border-industrial)]"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div
                    className={`p-2 rounded-lg ${
                      isSelected
                        ? "bg-emerald-500 text-white"
                        : "bg-[var(--card-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-emerald-500 stroke-[3]" />}
                </div>
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {t.label}
                </span>
                <span className="text-xs text-[var(--text-muted)] mt-0.5">
                  {t.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Category Architecture & Priority Manager */}
      <div className="pt-4 border-t border-[var(--border-subtle)]">
        <CategoryManager />
      </div>

      {/* 3. Debt & IOUs */}
      <div className="pt-4 border-t border-[var(--border-subtle)]">
        <DebtTracker />
      </div>

      {/* 4. Subscriptions & Automation */}
      <div className="pt-4 border-t border-[var(--border-subtle)]">
        <RecurringRulesManager />
      </div>

      {/* 5. CSV Data Portability */}
      <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Data Portability (CSV)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="industrial-card rounded-xl border border-[var(--border-subtle)] bg-[var(--card-bg)] p-4 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                Import Bank Statements
              </h4>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Upload bank and credit card statements with delimiter detection and duplicate checks.
              </p>
            </div>
            <button
              onClick={() => {
                playSound("click", soundEnabled);
                setCsvImportOpen(true);
              }}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] hover:bg-[var(--bg-surface-2)] py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors min-h-[40px]"
            >
              <FileSpreadsheet className="h-4 w-4 text-blue-500" />
              <span>Import Statement</span>
            </button>
          </div>

          <div className="industrial-card rounded-xl border border-[var(--border-subtle)] bg-[var(--card-bg)] p-4 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                Export Ledger Records
              </h4>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Export complete transaction histories, categorized accounts, and ledger records to CSV.
              </p>
            </div>
            <button
              onClick={() => {
                playSound("click", soundEnabled);
                setCsvExportOpen(true);
              }}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] hover:bg-[var(--bg-surface-2)] py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors min-h-[40px]"
            >
              <Download className="h-4 w-4 text-emerald-500" />
              <span>Export Records</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6. Security & Passcode Protocol */}
      <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Security &amp; Passcode
          </h3>
        </div>

        <div className="industrial-card rounded-xl border border-[var(--border-subtle)] bg-[var(--card-bg)] p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
            <div>
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-emerald-500" />
                <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                  Security Passcode
                </h4>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    isPinSet
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-amber-500/15 text-amber-500"
                  }`}
                >
                  {isPinSet ? "Configured" : "Default (0000)"}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                4 to 6 digit numeric passcode secured with salted Web Crypto SHA-256.
              </p>
            </div>

            <button
              onClick={() => {
                playSound("click", soundEnabled);
                setIsPinSettingsOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] hover:bg-[var(--bg-surface-2)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors shrink-0 min-h-[40px]"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>{isPinSet ? "Change Passcode" : "Set Passcode"}</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                  Session Auto-Lock
                </h4>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Automatically lock screen when idle or when switching browser tabs.
              </p>
            </div>

            <select
              value={autoLockTimeout}
              onChange={(e) => handleAutoLockChange(parseInt(e.target.value))}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-emerald-500 focus:outline-none shrink-0 min-h-[40px]"
            >
              <option value="0">Immediately on Blur / Tab Switch</option>
              <option value="1">1 Minute Inactivity</option>
              <option value="5">5 Minutes Inactivity (Default)</option>
              <option value="15">15 Minutes Inactivity</option>
              <option value="-1">Never (Manual Lock Only)</option>
            </select>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-secondary)]">Vibration &amp; Haptic Feedback</span>
            <button
              onClick={() => {
                playSound("toggle", soundEnabled);
                toggleHapticsEnabled();
              }}
              className={`rounded-xl px-3 py-1.5 border text-xs font-medium transition-colors min-h-[36px] ${
                hapticsEnabled
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-500"
                  : "border-[var(--border-subtle)] bg-[var(--card-surface)] text-[var(--text-muted)]"
              }`}
            >
              {hapticsEnabled ? "Haptics Enabled" : "Haptics Disabled"}
            </button>
          </div>
        </div>
      </div>

      {/* 7. REST API Credentials */}
      <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            REST API Credentials
          </h3>
        </div>

        <div className="industrial-card rounded-xl border border-[var(--border-subtle)] bg-[var(--card-bg)] p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              API Bearer Key
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={apiKey}
                className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3.5 py-2 font-mono-num text-xs text-[var(--text-primary)] focus:outline-none select-all min-h-[40px]"
              />
              <button
                onClick={handleCopyKey}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--card-surface)] hover:bg-[var(--bg-surface-2)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors min-h-[40px]"
              >
                {copiedKey ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                <span>{copiedKey ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-[var(--text-muted)] mb-1.5 flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5" />
              <span>Example API Request</span>
            </div>
            <pre className="rounded-xl bg-[var(--bg-void)] p-3.5 text-xs font-mono-num text-[var(--text-secondary)] overflow-x-auto border border-[var(--border-subtle)]">
              {`curl -X POST http://localhost:3000/api/v1/transactions \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"desc":"Coffee","amount":50000,"type":"expense","fromAccountId":"acc_bca"}'`}
            </pre>
          </div>
        </div>
      </div>

      {/* 8. Danger Zone: Reset All Data */}
      <div className="pt-4 border-t border-rose-500/20 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-500" />
          <h3 className="text-sm font-semibold text-rose-500">
            Danger Zone
          </h3>
        </div>

        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-primary)]">
              Reset All Data
            </h4>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-lg">
              Permanently clears all transactions, accounts, debts, and savings goals from both local storage and cloud database. Keeps your login account and passcode intact.
            </p>
          </div>

          <button
            onClick={() => {
              playSound("click", soundEnabled);
              setIsResetModalOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition-colors shrink-0 min-h-[40px]"
          >
            <span>Reset Data</span>
          </button>
        </div>
      </div>

      {/* PIN Settings Modal */}
      <PinSettingsModal
        isOpen={isPinSettingsOpen}
        onClose={() => setIsPinSettingsOpen(false)}
      />

      {/* Factory Reset Modal */}
      <FactoryResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
      />
    </div>
  );
};
