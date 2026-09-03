import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Transaction } from "../lib/types";

export type NavTab = "overview" | "analytics" | "accounts" | "vaults" | "tools";

interface UIState {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;

  privacyMode: boolean;
  togglePrivacyMode: () => void;
  setPrivacyMode: (val: boolean) => void;

  soundEnabled: boolean;
  toggleSoundEnabled: () => void;

  hapticsEnabled: boolean;
  toggleHapticsEnabled: () => void;

  isCmdBarOpen: boolean;
  setCmdBarOpen: (open: boolean) => void;

  isQuickTxOpen: boolean;
  quickTxDraft: Partial<Transaction> | null;
  openQuickTx: (draft?: Partial<Transaction>) => void;
  closeQuickTx: () => void;

  isCsvImportOpen: boolean;
  setCsvImportOpen: (open: boolean) => void;

  isCsvExportOpen: boolean;
  setCsvExportOpen: (open: boolean) => void;

  isLocked: boolean;
  setLocked: (locked: boolean) => void;

  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeTab: "overview",
      setActiveTab: (activeTab) => set({ activeTab }),

      privacyMode: false,
      togglePrivacyMode: () => set((state) => ({ privacyMode: !state.privacyMode })),
      setPrivacyMode: (privacyMode) => set({ privacyMode }),

      soundEnabled: true,
      toggleSoundEnabled: () => set((state) => ({ soundEnabled: !state.soundEnabled })),

      hapticsEnabled: true,
      toggleHapticsEnabled: () =>
        set((state) => ({ hapticsEnabled: !state.hapticsEnabled })),

      isCmdBarOpen: false,
      setCmdBarOpen: (isCmdBarOpen) => set({ isCmdBarOpen }),

      isQuickTxOpen: false,
      quickTxDraft: null,
      openQuickTx: (draft) => set({ isQuickTxOpen: true, quickTxDraft: draft || null }),
      closeQuickTx: () => set({ isQuickTxOpen: false, quickTxDraft: null }),

      isCsvImportOpen: false,
      setCsvImportOpen: (isCsvImportOpen) => set({ isCsvImportOpen }),

      isCsvExportOpen: false,
      setCsvExportOpen: (isCsvExportOpen) => set({ isCsvExportOpen }),

      isLocked: false,
      setLocked: (isLocked) => set({ isLocked }),

      selectedAccountId: null,
      setSelectedAccountId: (selectedAccountId) => set({ selectedAccountId }),
    }),
    {
      name: "financeos_ui_prefs",
      partialize: (state) => ({
        privacyMode: state.privacyMode,
        soundEnabled: state.soundEnabled,
        hapticsEnabled: state.hapticsEnabled,
      }),
    }
  )
);
