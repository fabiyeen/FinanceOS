"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../lib/auth/authContext";
import { AuthScreen } from "./AuthScreen";
import { PinLockScreen } from "../security/PinLockScreen";
import { PinSettingsModal } from "../security/PinSettingsModal";
import { useUIStore } from "../../store/useUIStore";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { Shield } from "lucide-react";
import { initFirestoreSync } from "../../lib/db/syncEngine";

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const { isLocked, setLocked } = useUIStore();
  const settings = useLiveQuery(() => db.settings.get("main"));

  const [isPinSettingsOpen, setIsPinSettingsOpen] = useState(false);
  const lastActiveRef = useRef<number>(Date.now());

  // Two-Way Realtime Cloud Sync Lifecycle
  useEffect(() => {
    if (!user || user.isDemo) return;
    const unsubscribe = initFirestoreSync(user.uid);
    return () => {
      unsubscribe();
    };
  }, [user?.uid, user?.isDemo]);

  // Inactivity Auto-lock Timer
  useEffect(() => {
    if (!user || isLocked) return;

    const timeoutMinutes = settings?.security?.autoLockTimeoutMinutes ?? 5;
    if (timeoutMinutes === -1) return; // Disabled

    // Immediate lock on blur if 0
    const handleVisibility = () => {
      if (document.hidden && timeoutMinutes === 0) {
        setLocked(true);
      }
    };

    const handleActivity = () => {
      lastActiveRef.current = Date.now();
    };

    const interval = setInterval(() => {
      if (timeoutMinutes > 0) {
        const elapsedMinutes = (Date.now() - lastActiveRef.current) / (1000 * 60);
        if (elapsedMinutes >= timeoutMinutes) {
          setLocked(true);
        }
      }
    }, 10000);

    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pointerdown", handleActivity);
    window.addEventListener("keydown", handleActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
    };
  }, [user, isLocked, settings?.security?.autoLockTimeoutMinutes, setLocked]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#07090E] p-4 text-center">
        <div className="h-12 w-12 rounded-xl border border-[#00F0FF] bg-[#0F131C] flex items-center justify-center animate-pulse shadow-[0_0_20px_#00F0FF]">
          <Shield className="h-6 w-6 text-[#00F0FF]" />
        </div>
        <div className="font-mono-num text-xs font-bold uppercase tracking-widest text-[#00F0FF] mt-4">
          [FINANCE_OS // INITIALIZING TENANT PERSISTENCE]
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <>
      {children}

      {/* Dynamic Master PIN Lock Screen */}
      <PinLockScreen
        onOpenPinSettings={() => setIsPinSettingsOpen(true)}
      />

      {/* Master PIN Configuration Modal */}
      <PinSettingsModal
        isOpen={isPinSettingsOpen}
        onClose={() => setIsPinSettingsOpen(false)}
      />
    </>
  );
};
