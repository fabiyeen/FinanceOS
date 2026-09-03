"use client";

import React from "react";
import {
  LayoutDashboard,
  BarChart3,
  Wallet,
  Landmark,
  Wrench,
  Command,
} from "lucide-react";
import { NavTab, useUIStore } from "../../store/useUIStore";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";

interface TabItem {
  id: NavTab;
  label: string;
  icon: React.ElementType;
}

const TABS: TabItem[] = [
  { id: "overview", label: "OVERVIEW", icon: LayoutDashboard },
  { id: "analytics", label: "ANALYTICS", icon: BarChart3 },
  { id: "accounts", label: "ACCOUNTS", icon: Wallet },
  { id: "vaults", label: "VAULTS", icon: Landmark },
  { id: "tools", label: "TOOLS", icon: Wrench },
];

export const BottomDeck: React.FC = () => {
  const { activeTab, setActiveTab, soundEnabled, setCmdBarOpen } = useUIStore();

  const handleTabClick = (tab: NavTab) => {
    playSound("tab", soundEnabled);
    triggerHaptic(12);
    setActiveTab(tab);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#232A3B] bg-[#07090E]/95 backdrop-blur-md px-2 py-1.5 sm:py-2">
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {TABS.slice(0, 2).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex flex-1 flex-col items-center justify-center py-1 transition-all ${
                isActive
                  ? "text-[#00F0FF]"
                  : "text-[#64748B] hover:text-[#94A3B8]"
              }`}
            >
              <Icon className={`h-4 w-4 sm:h-5 sm:w-5 transition-transform ${isActive ? "scale-110" : ""}`} />
              <span className="font-mono-num text-[9px] sm:text-[10px] tracking-wider mt-0.5">
                {tab.label}
              </span>
              {isActive && (
                <span className="mt-0.5 h-0.5 w-5 rounded-full bg-[#00F0FF] shadow-[0_0_6px_#00F0FF]" />
              )}
            </button>
          );
        })}

        {/* Center Floating Command Trigger */}
        <button
          onClick={() => {
            playSound("click", soundEnabled);
            triggerHaptic(20);
            setCmdBarOpen(true);
          }}
          className="relative -top-3 mx-1 flex h-11 w-11 items-center justify-center rounded-lg border border-[#00F0FF] bg-[#0F131C] text-[#00F0FF] shadow-[0_0_16px_rgba(0,240,255,0.3)] hover:scale-105 active:scale-95 transition-all"
          title="Command Bar (Cmd+K)"
        >
          <Command className="h-5 w-5" />
          <span className="absolute -bottom-4 font-mono-num text-[8px] text-[#64748B] uppercase tracking-widest font-bold">
            CMD+K
          </span>
        </button>

        {TABS.slice(2).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex flex-1 flex-col items-center justify-center py-1 transition-all ${
                isActive
                  ? "text-[#00F0FF]"
                  : "text-[#64748B] hover:text-[#94A3B8]"
              }`}
            >
              <Icon className={`h-4 w-4 sm:h-5 sm:w-5 transition-transform ${isActive ? "scale-110" : ""}`} />
              <span className="font-mono-num text-[9px] sm:text-[10px] tracking-wider mt-0.5">
                {tab.label}
              </span>
              {isActive && (
                <span className="mt-0.5 h-0.5 w-5 rounded-full bg-[#00F0FF] shadow-[0_0_6px_#00F0FF]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
