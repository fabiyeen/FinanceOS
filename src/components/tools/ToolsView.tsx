"use client";

import React, { useState } from "react";
import {
  FileSpreadsheet,
  Download,
  Key,
  Shield,
  Copy,
  Check,
  Code2,
  Terminal,
  KeyRound,
  Clock,
  Flame,
  AlertTriangle,
} from "lucide-react";
import { DebtTracker } from "../ledger/DebtTracker";
import { RecurringRulesManager } from "../ledger/RecurringRulesManager";
import { PinSettingsModal } from "../security/PinSettingsModal";
import { FactoryResetModal } from "../modals/FactoryResetModal";
import { useUIStore } from "../../store/useUIStore";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";

export const ToolsView: React.FC = () => {
  const {
    setCsvImportOpen,
    setCsvExportOpen,
    soundEnabled,
    hapticsEnabled,
    toggleHapticsEnabled,
  } = useUIStore();

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

  return (
    <div className="space-y-8">
      {/* 1. Debt & IOUs */}
      <DebtTracker />

      {/* 2. Subscriptions & Automation */}
      <div className="pt-4 border-t border-[#232A3B]">
        <RecurringRulesManager />
      </div>

      {/* 3. CSV Data Portability */}
      <div className="pt-4 border-t border-[#232A3B] space-y-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-[#FFB800]" />
          <h3 className="font-mono-num text-sm font-bold uppercase tracking-wider text-white">
            Data Portability (CSV Engine)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="industrial-card rounded-lg border border-[#232A3B] bg-[#0F131C] p-4 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-white font-mono-num uppercase">
                Import Bank Statements
              </h4>
              <p className="text-xs text-[#94A3B8] font-mono-num mt-1">
                Drag-and-drop statements with delimiter detection, column mapping, and duplicate hashing.
              </p>
            </div>
            <button
              onClick={() => {
                playSound("click", soundEnabled);
                setCsvImportOpen(true);
              }}
              className="mt-4 flex items-center justify-center gap-2 rounded border border-[#FFB800]/50 bg-[#FFB800]/10 py-2 text-xs font-mono-num font-bold text-[#FFB800] hover:bg-[#FFB800]/20 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4" />
              LAUNCH IMPORT WIZARD
            </button>
          </div>

          <div className="industrial-card rounded-lg border border-[#232A3B] bg-[#0F131C] p-4 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-white font-mono-num uppercase">
                Export Standard Ledger CSV
              </h4>
              <p className="text-xs text-[#94A3B8] font-mono-num mt-1">
                Download filterable double-entry ledger exports compatible with accounting software.
              </p>
            </div>
            <button
              onClick={() => {
                playSound("click", soundEnabled);
                setCsvExportOpen(true);
              }}
              className="mt-4 flex items-center justify-center gap-2 rounded border border-[#00FF88]/50 bg-[#00FF88]/10 py-2 text-xs font-mono-num font-bold text-[#00FF88] hover:bg-[#00FF88]/20 transition-colors"
            >
              <Download className="h-4 w-4" />
              CONFIGURE EXPORT
            </button>
          </div>
        </div>
      </div>

      {/* 4. Security & PIN Protocol */}
      <div className="pt-4 border-t border-[#232A3B] space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#00F0FF]" />
          <h3 className="font-mono-num text-sm font-bold uppercase tracking-wider text-white">
            Security &amp; Session Authentication
          </h3>
        </div>

        <div className="industrial-card rounded-lg border border-[#232A3B] bg-[#0F131C] p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#232A3B]">
            <div>
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[#00F0FF]" />
                <h4 className="text-xs font-bold font-mono-num text-white uppercase">
                  Master Security PIN
                </h4>
                <span
                  className={`rounded px-1.5 py-0.2 text-[9px] font-mono-num font-bold uppercase ${
                    isPinSet
                      ? "bg-[#00FF88]/15 text-[#00FF88] border border-[#00FF88]/30"
                      : "bg-[#FF5C00]/15 text-[#FF5C00] border border-[#FF5C00]/30"
                  }`}
                >
                  {isPinSet ? "[CONFIGURED]" : "[DEFAULT 0000 ACTIVE]"}
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] font-mono-num mt-1">
                4 to 6 digit numeric code secured with salted Web Crypto SHA-256.
              </p>
            </div>

            <button
              onClick={() => {
                playSound("click", soundEnabled);
                setIsPinSettingsOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 rounded border border-[#00F0FF]/50 bg-[#00F0FF]/10 px-3 py-2 text-xs font-mono-num text-[#00F0FF] hover:bg-[#00F0FF]/20 transition-colors shrink-0"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>{isPinSet ? "CHANGE MASTER PIN" : "CONFIGURE MASTER PIN"}</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#232A3B]">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#FFB800]" />
                <h4 className="text-xs font-bold font-mono-num text-white uppercase">
                  Session Inactivity Auto-Lock
                </h4>
              </div>
              <p className="text-xs text-[#94A3B8] font-mono-num mt-1">
                Automatically engage PIN lock screen when idle or when browser tab loses focus.
              </p>
            </div>

            <select
              value={autoLockTimeout}
              onChange={(e) => handleAutoLockChange(parseInt(e.target.value))}
              className="rounded border border-[#232A3B] bg-[#07090E] px-3 py-1.5 text-xs text-white focus:border-[#00F0FF] focus:outline-none font-mono-num shrink-0"
            >
              <option value="0">Immediately on Blur / Tab Switch</option>
              <option value="1">1 Minute Inactivity</option>
              <option value="5">5 Minutes Inactivity (Default)</option>
              <option value="15">15 Minutes Inactivity</option>
              <option value="-1">Never (Manual Lock Only)</option>
            </select>
          </div>

          <div className="flex items-center justify-between text-xs font-mono-num">
            <span className="text-[#94A3B8]">Tactile Audio &amp; Haptic Vibration</span>
            <button
              onClick={() => {
                playSound("toggle", soundEnabled);
                toggleHapticsEnabled();
              }}
              className={`rounded px-2.5 py-1 border text-[10px] transition-colors ${
                hapticsEnabled
                  ? "border-[#00FF88]/40 bg-[#00FF88]/15 text-[#00FF88]"
                  : "border-[#232A3B] bg-[#161B26] text-[#64748B]"
              }`}
            >
              {hapticsEnabled ? "HAPTICS [ON]" : "HAPTICS [OFF]"}
            </button>
          </div>
        </div>
      </div>

      {/* 5. Companion REST API */}
      <div className="pt-4 border-t border-[#232A3B] space-y-3">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-[#00F0FF]" />
          <h3 className="font-mono-num text-sm font-bold uppercase tracking-wider text-white">
            Companion REST API Credentials
          </h3>
        </div>

        <div className="industrial-card rounded-lg border border-[#232A3B] bg-[#0F131C] p-4 space-y-4">
          <div>
            <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
              Active Companion API Bearer Key
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={apiKey}
                className="flex-1 rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 font-mono-num text-xs text-[#00F0FF] focus:outline-none select-all"
              />
              <button
                onClick={handleCopyKey}
                className="flex items-center gap-1.5 rounded border border-[#232A3B] bg-[#161B26] px-3 py-2 text-xs font-mono-num text-[#94A3B8] hover:text-white transition-colors"
              >
                {copiedKey ? <Check className="h-4 w-4 text-[#00FF88]" /> : <Copy className="h-4 w-4" />}
                <span>{copiedKey ? "COPIED" : "COPY"}</span>
              </button>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1 flex items-center gap-1">
              <Terminal className="h-3 w-3" />
              CURL Integration Example
            </div>
            <pre className="rounded bg-[#07090E] p-3 text-[11px] font-mono-num text-[#94A3B8] overflow-x-auto border border-[#232A3B]">
              {`curl -X POST http://localhost:3000/api/v1/transactions \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"desc":"Coffee","amount":50000,"type":"expense","fromAccountId":"acc_bca"}'`}
            </pre>
          </div>
        </div>
      </div>

      {/* 6. Danger Zone: Nuclear Factory Reset */}
      <div className="pt-4 border-t border-[#FF5C00]/40 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#FF5C00]" />
          <h3 className="font-mono-num text-sm font-bold uppercase tracking-wider text-[#FF5C00]">
            Danger Zone
          </h3>
        </div>

        <div className="rounded-lg border border-[#FF5C00]/40 bg-[#FF5C00]/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-bold text-white font-mono-num uppercase">
              Nuclear Ledger Factory Reset
            </h4>
            <p className="text-xs text-[#94A3B8] font-mono-num mt-1 max-w-lg">
              Permanently purges all transactions, accounts, debts, and vaults from both IndexedDB and Firestore. Reseeds fresh baseline accounts while keeping your login identity and PIN intact.
            </p>
          </div>

          <button
            onClick={() => {
              playSound("click", soundEnabled);
              setIsResetModalOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 rounded border border-[#FF5C00] bg-[#FF5C00]/20 px-4 py-2 text-xs font-mono-num font-bold text-[#FF5C00] hover:bg-[#FF5C00]/30 transition-colors shrink-0"
          >
            <Flame className="h-4 w-4" />
            <span>PURGE LEDGER</span>
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
