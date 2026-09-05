"use client";

import React from "react";
import {
  LayoutDashboard,
  BarChart3,
  Wallet,
  Target,
  Settings,
  Plus,
} from "lucide-react";
import { NavTab, useUIStore } from "../../store/useUIStore";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";

interface TabItem {
  id: NavTab;
  label: string;
  icon: React.ElementType;
}

const TABS: TabItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "accounts", label: "Wallets", icon: Wallet },
  { id: "vaults", label: "Goals", icon: Target },
  { id: "tools", label: "Settings", icon: Settings },
];

export const BottomDeck: React.FC = () => {
  const { activeTab, setActiveTab, soundEnabled, openQuickTx } = useUIStore();

  const handleTabClick = (tab: NavTab) => {
    playSound("tab", soundEnabled);
    triggerHaptic(12);
    setActiveTab(tab);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-1)]/95 backdrop-blur-md px-2 pt-1 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] transition-colors duration-150">
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {/* First 2 Tabs: Overview, Analytics */}
        {TABS.slice(0, 2).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex flex-1 flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 transition-colors ${
                isActive
                  ? "text-emerald-500 font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <Icon className={`h-5 w-5 transition-transform ${isActive ? "scale-105" : ""}`} />
              <span className="text-[10px] tracking-tight mt-1">
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* Center Floating Quick Add Action */}
        <button
          onClick={() => {
            playSound("click", soundEnabled);
            triggerHaptic(20);
            openQuickTx();
          }}
          className="relative -top-2 mx-1 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md hover:bg-emerald-600 hover:scale-105 active:scale-95 transition-all min-h-[44px] min-w-[44px]"
          title="Add Transaction"
        >
          <Plus className="h-6 w-6 stroke-[2.5]" />
        </button>

        {/* Last 3 Tabs: Wallets, Goals, Settings */}
        {TABS.slice(2).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex flex-1 flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 transition-colors ${
                isActive
                  ? "text-emerald-500 font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <Icon className={`h-5 w-5 transition-transform ${isActive ? "scale-105" : ""}`} />
              <span className="text-[10px] tracking-tight mt-1">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
