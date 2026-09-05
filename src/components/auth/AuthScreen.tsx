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
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] p-4 relative overflow-hidden">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-xl relative z-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-canvas)] shadow-sm">
            <Shield className="h-6 w-6 text-[var(--accent-primary)]" />
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
            FinanceOS
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Sign in to access your financial dashboard
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--bg-canvas)] p-1 border border-[var(--border-default)]">
          <button
            type="button"
            onClick={() => {
              playSound("tab", soundEnabled);
              setTab("signin");
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all rounded-lg ${
              tab === "signin"
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              playSound("tab", soundEnabled);
              setTab("signup");
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all rounded-lg ${
              tab === "signup"
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Create Account
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === "signup" && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-1">
              <Mail className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-1">
              <Lock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
          </div>

          {tab === "signup" && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-[var(--color-rose)]/30 bg-[var(--color-rose)]/10 p-2.5 text-xs text-[var(--color-rose)]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] py-2.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50"
          >
            <span>
              {isSubmitting
                ? "Please wait..."
                : tab === "signin"
                ? "Sign In"
                : "Create Account"}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Quick Demo Profiles */}
        <div className="pt-4 border-t border-[var(--border-default)] space-y-2.5">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1 font-medium">
              <Users className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              Demo Test Accounts
            </span>
            <span>Local Isolated Data</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDemoOperative("operative_a")}
              className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-canvas)] p-2.5 text-left hover:border-[var(--accent-primary)] transition-colors"
            >
              <div className="text-xs font-semibold text-[var(--text-primary)]">
                Demo User A
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Kenji • Sample Data
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleDemoOperative("operative_b")}
              className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-canvas)] p-2.5 text-left hover:border-[var(--accent-primary)] transition-colors"
            >
              <div className="text-xs font-semibold text-[var(--text-primary)]">
                Demo User B
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Rei • Clean Ledger
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
