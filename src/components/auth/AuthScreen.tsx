"use client";

import React, { useState } from "react";
import { Shield, Key, Mail, Lock, ArrowRight, UserPlus, LogIn, Users } from "lucide-react";
import { useAuth } from "../../lib/auth/authContext";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { useUIStore } from "../../store/useUIStore";

export const AuthScreen: React.FC = () => {
  const { signIn, signUp, signInWithDemoOperative } = useAuth();
  const { soundEnabled } = useUIStore();

  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please fill all required credentials");
      playSound("alert", soundEnabled);
      return;
    }

    if (tab === "signup" && password !== confirmPassword) {
      setError("Password confirmation does not match");
      playSound("alert", soundEnabled);
      return;
    }

    if (password.length < 6) {
      setError("Security requirement: Minimum 6 characters for password");
      playSound("alert", soundEnabled);
      return;
    }

    setIsSubmitting(true);
    playSound("click", soundEnabled);
    triggerHaptic(20);

    try {
      if (tab === "signin") {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, displayName.trim());
      }
      playSound("success", soundEnabled);
      triggerHaptic(30);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setError(msg.replace("Firebase: ", ""));
      playSound("alert", soundEnabled);
      triggerHaptic([40, 50, 40]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoOperative = async (id: "operative_a" | "operative_b") => {
    setIsSubmitting(true);
    playSound("click", soundEnabled);
    triggerHaptic(20);
    try {
      await signInWithDemoOperative(id);
      playSound("success", soundEnabled);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Demo sign in failed";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07090E] p-4 relative overflow-hidden">
      {/* Background Micro-Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#232A3B18_1px,transparent_1px),linear-gradient(to_bottom,#232A3B18_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      <div className="w-full max-w-md industrial-card rounded-xl border border-[#232A3B] bg-[#0F131C] p-6 sm:p-8 shadow-[0_12px_50px_rgba(0,0,0,0.8)] relative z-10 space-y-6">
        {/* Terminal Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-[#00F0FF]/40 bg-[#07090E] shadow-[0_0_24px_rgba(0,240,255,0.25)]">
            <Shield className="h-7 w-7 text-[#00F0FF]" />
          </div>
          <h1 className="font-mono-num text-base sm:text-lg font-bold tracking-widest text-white uppercase">
            FINANCE<span className="text-[#00F0FF]">_OS</span> // IDENTITY ACCESS
          </h1>
          <p className="text-xs font-mono-num text-[#64748B]">
            Multi-Tenant Zero-Knowledge Cloud Ledger Partitioning
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#07090E] p-1 border border-[#232A3B]">
          <button
            type="button"
            onClick={() => {
              playSound("tab", soundEnabled);
              setTab("signin");
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-mono-num transition-all rounded ${
              tab === "signin"
                ? "bg-[#1E2536] text-[#00F0FF] border border-[#384259] font-bold shadow-sm"
                : "text-[#64748B] hover:text-[#94A3B8]"
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            SIGN IN
          </button>
          <button
            type="button"
            onClick={() => {
              playSound("tab", soundEnabled);
              setTab("signup");
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-mono-num transition-all rounded ${
              tab === "signup"
                ? "bg-[#1E2536] text-[#00F0FF] border border-[#384259] font-bold shadow-sm"
                : "text-[#64748B] hover:text-[#94A3B8]"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            REGISTER
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === "signup" && (
            <div>
              <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                Operative Codename
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Kenji, Akira"
                className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white placeholder-[#475569] focus:border-[#00F0FF] focus:outline-none font-mono-num"
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1 flex items-center gap-1">
              <Mail className="h-3 w-3 text-[#00F0FF]" />
              Account Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operative@cyberia.org"
              required
              className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white placeholder-[#475569] focus:border-[#00F0FF] focus:outline-none font-mono-num"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1 flex items-center gap-1">
              <Lock className="h-3 w-3 text-[#00F0FF]" />
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white placeholder-[#475569] focus:border-[#00F0FF] focus:outline-none font-mono-num"
            />
          </div>

          {tab === "signup" && (
            <div>
              <label className="block text-[10px] font-mono-num uppercase tracking-wider text-[#64748B] mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full rounded border border-[#232A3B] bg-[#07090E] px-3 py-2 text-xs text-white placeholder-[#475569] focus:border-[#00F0FF] focus:outline-none font-mono-num"
              />
            </div>
          )}

          {error && (
            <div className="rounded border border-[#FF0055]/40 bg-[#FF0055]/10 p-2.5 text-xs font-mono-num text-[#FF0055]">
              [ERROR]: {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded border border-[#00F0FF]/60 bg-[#00F0FF]/15 py-2.5 text-xs font-bold font-mono-num text-[#00F0FF] hover:bg-[#00F0FF]/25 transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)] disabled:opacity-50"
          >
            <span>
              {isSubmitting
                ? "AUTHENTICATING..."
                : tab === "signin"
                ? "ACCESS SECURE LEDGER"
                : "INITIALIZE TENANT & RESEED"}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Quick Multi-Tenant Demo Operatives */}
        <div className="pt-4 border-t border-[#232A3B] space-y-2.5">
          <div className="flex items-center justify-between text-[10px] font-mono-num uppercase text-[#64748B]">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3 text-[#FFB800]" />
              Multi-User Device Testing
            </span>
            <span>Zero Data Leakage</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDemoOperative("operative_a")}
              className="rounded border border-[#232A3B] bg-[#161B26] p-2 text-left hover:border-[#00FF88]/50 transition-colors"
            >
              <div className="text-xs font-bold font-mono-num text-[#00FF88]">
                Operative Alpha
              </div>
              <div className="text-[10px] text-[#64748B] font-mono-num">
                (Kenji) • Tokyo Data
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleDemoOperative("operative_b")}
              className="rounded border border-[#232A3B] bg-[#161B26] p-2 text-left hover:border-[#00F0FF]/50 transition-colors"
            >
              <div className="text-xs font-bold font-mono-num text-[#00F0FF]">
                Operative Beta
              </div>
              <div className="text-[10px] text-[#64748B] font-mono-num">
                (Rei) • Clean Ledger
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
