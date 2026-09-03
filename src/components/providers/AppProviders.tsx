"use client";

import React, { useEffect } from "react";
import { AuthProvider } from "../../lib/auth/authContext";
import { AuthGate } from "../auth/AuthGate";
import { TopDock } from "../layout/TopDock";
import { BottomDeck } from "../layout/BottomDeck";
import { UniversalCmdBar } from "../command/UniversalCmdBar";
import { QuickTransactionModal } from "../ledger/QuickTransactionModal";
import { CsvImportWizard } from "../csv/CsvImportWizard";
import { CsvExportModal } from "../csv/CsvExportModal";
import { AccountModal } from "../accounts/AccountModal";
import { VaultModal } from "../vaults/VaultModal";
import { CategoryManagerModal } from "../tools/CategoryManager";
import { useUIStore } from "../../store/useUIStore";

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    isAccountModalOpen,
    editingAccount,
    closeAccountModal,
    isVaultModalOpen,
    editingVault,
    closeVaultModal,
  } = useUIStore();

  useEffect(() => {
    // Register Service Worker for PWA
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[FinanceOS PWA] Service Worker active:", reg.scope);
        })
        .catch((err) => {
          console.log("[FinanceOS PWA] Service Worker registration failed:", err);
        });
    }
  }, []);

  return (
    <AuthProvider>
      <AuthGate>
        <div className="min-h-screen flex flex-col bg-[#07090E] text-[#F1F5F9] pb-24 selection:bg-[#00F0FF]/30 selection:text-white">
          <TopDock />
          <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
            {children}
          </main>
          <BottomDeck />

          {/* Ephemeral Modals */}
          <UniversalCmdBar />
          <QuickTransactionModal />
          <CsvImportWizard />
          <CsvExportModal />
          <AccountModal
            isOpen={isAccountModalOpen}
            accountToEdit={editingAccount}
            onClose={closeAccountModal}
          />
          <VaultModal
            isOpen={isVaultModalOpen}
            vaultToEdit={editingVault}
            onClose={closeVaultModal}
          />
          <CategoryManagerModal />
        </div>
      </AuthGate>
    </AuthProvider>
  );
};
