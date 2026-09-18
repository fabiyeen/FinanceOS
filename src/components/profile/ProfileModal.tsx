"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  User,
  Shield,
  X,
  Check,
  AlertCircle,
  Mail,
  KeyRound,
  Lock,
  LogOut,
  Calendar,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  CheckCircle2,
  RefreshCw,
  Send,
} from "lucide-react";
import { useAuth } from "../../lib/auth/authContext";
import { useUIStore } from "../../store/useUIStore";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { auth, isFirebaseConfigured } from "../../lib/firebase/config";
import {
  updateProfile,
  updatePassword,
  verifyBeforeUpdateEmail,
  sendEmailVerification,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { PinSettingsModal } from "../security/PinSettingsModal";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ProfileTab = "profile" | "security";

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, signOut, updateUser, verifyPassword } = useAuth();
  const { soundEnabled, setLocked } = useUIStore();

  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [displayName, setDisplayName] = useState("");
  const [copiedUid, setCopiedUid] = useState(false);

  // Email state
  const [newEmail, setNewEmail] = useState("");
  const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // PIN settings nested trigger
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Profile save state
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Status & notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);

  // Sync initial user state
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || user.email.split("@")[0] || "");
    }
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [user, isOpen]);

  // Physical escape key listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPinModalOpen) {
        playSound("click", soundEnabled);
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, soundEnabled, isPinModalOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) {
      playSound("click", soundEnabled);
      onClose();
    }
  };

  const mapAuthError = (err: unknown): string => {
    if (typeof err === "object" && err !== null && "code" in err) {
      const code = (err as { code: string }).code;
      switch (code) {
        case "auth/wrong-password":
        case "auth/invalid-credential":
          return "Incorrect current password.";
        case "auth/requires-recent-login":
          return "Security timeout. Please enter your current password to continue.";
        case "auth/email-already-in-use":
          return "This email address is already registered.";
        case "auth/weak-password":
          return "Password should be at least 8 characters.";
        case "auth/invalid-email":
          return "Please enter a valid email address.";
        case "auth/too-many-requests":
          return "Too many attempts. Please try again later.";
        case "auth/user-mismatch":
          return "Current password does not match this user.";
        default:
          return (err as { message?: string }).message || "An authentication error occurred.";
      }
    }
    return err instanceof Error ? err.message : "An unexpected error occurred.";
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getUserInitials = () => {
    const name = displayName.trim() || user?.displayName || user?.email || "User";
    const parts = name.split(/[\s@._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Action: Save Display Name
  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    const trimmed = displayName.trim();
    if (!trimmed) {
      setErrorMsg("Display name cannot be blank.");
      return;
    }

    setIsSavingProfile(true);
    playSound("click", soundEnabled);
    triggerHaptic(15);

    try {
      if (auth && isFirebaseConfigured && auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: trimmed });
      }
      updateUser({ displayName: trimmed });
      setSuccessMsg("Profile name updated successfully.");
      playSound("success", soundEnabled);
      triggerHaptic(25);
    } catch (err) {
      console.error("[ProfileModal] Update profile failed:", err);
      setErrorMsg(mapAuthError(err));
      playSound("alert", soundEnabled);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Action: Resend Verification Email
  const handleResendVerification = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsResendingVerification(true);
    playSound("click", soundEnabled);

    try {
      if (auth && isFirebaseConfigured && auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        setSuccessMsg("Verification email sent! Please check your inbox.");
        playSound("success", soundEnabled);
      } else {
        setSuccessMsg("Verification email simulated for demo account.");
      }
    } catch (err) {
      console.error("[ProfileModal] Resend verification failed:", err);
      setErrorMsg(mapAuthError(err));
      playSound("alert", soundEnabled);
    } finally {
      setIsResendingVerification(false);
    }
  };

  // Action: Change Email
  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const emailTrimmed = newEmail.trim();
    if (!emailTrimmed) {
      setErrorMsg("Please enter a new email address.");
      return;
    }
    if (emailTrimmed.toLowerCase() === user?.email.toLowerCase()) {
      setErrorMsg("New email must be different from current email.");
      return;
    }
    if (!emailCurrentPassword) {
      setErrorMsg("Please enter your current password to authorize email change.");
      return;
    }

    setIsUpdatingEmail(true);
    playSound("click", soundEnabled);
    triggerHaptic(15);

    try {
      if (auth && isFirebaseConfigured && auth.currentUser && user?.email) {
        const credential = EmailAuthProvider.credential(user.email, emailCurrentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await verifyBeforeUpdateEmail(auth.currentUser, emailTrimmed);
        setSuccessMsg("Verification link sent to your new email. Please verify to complete the change.");
        setNewEmail("");
        setEmailCurrentPassword("");
        playSound("success", soundEnabled);
        triggerHaptic(25);
      } else {
        // Demo / offline mode
        const isValid = await verifyPassword(emailCurrentPassword);
        if (!isValid) {
          setErrorMsg("Incorrect current password.");
          playSound("alert", soundEnabled);
          return;
        }
        updateUser({ email: emailTrimmed, emailVerified: false });
        setSuccessMsg("Email address updated in local session.");
        setNewEmail("");
        setEmailCurrentPassword("");
        playSound("success", soundEnabled);
      }
    } catch (err) {
      console.error("[ProfileModal] Change email failed:", err);
      setErrorMsg(mapAuthError(err));
      playSound("alert", soundEnabled);
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  // Action: Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!currentPassword) {
      setErrorMsg("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg("Password should be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("New passwords do not match.");
      return;
    }

    setIsUpdatingPassword(true);
    playSound("click", soundEnabled);
    triggerHaptic(15);

    try {
      if (auth && isFirebaseConfigured && auth.currentUser && user?.email) {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPassword);
        setSuccessMsg("Password changed successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        playSound("success", soundEnabled);
        triggerHaptic(30);
      } else {
        // Demo / offline mode
        const isValid = await verifyPassword(currentPassword);
        if (!isValid) {
          setErrorMsg("Incorrect current password.");
          playSound("alert", soundEnabled);
          return;
        }
        setSuccessMsg("Password changed successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        playSound("success", soundEnabled);
      }
    } catch (err) {
      console.error("[ProfileModal] Change password failed:", err);
      setErrorMsg(mapAuthError(err));
      playSound("alert", soundEnabled);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Action: Sign Out
  const handleSignOut = async () => {
    if (confirm("Are you sure you want to sign out of FinanceOS?")) {
      playSound("click", soundEnabled);
      triggerHaptic(25);
      setLocked(false);
      onClose();
      await signOut();
    }
  };

  const handleCopyUid = () => {
    if (!user?.uid) return;
    playSound("click", soundEnabled);
    triggerHaptic(15);
    navigator.clipboard.writeText(user.uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  return (
    <>
      <div
        ref={overlayRef}
        onClick={handleBackdropClick}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      >
        <div
          className="w-full max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[#0F131C] dark:bg-[#0F131C] light:bg-white shadow-2xl overflow-hidden transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 px-5 py-4 bg-[#0F131C] dark:bg-[#0F131C] light:bg-white shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 font-bold text-sm">
                <User className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white dark:text-white light:text-slate-900 leading-tight">
                  Account Profile
                </h3>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-400 light:text-slate-500 truncate max-w-[240px]">
                  {user?.email || "user@financeos.local"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                playSound("click", soundEnabled);
                onClose();
              }}
              className="p-1.5 rounded-lg border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-slate-100 text-zinc-400 hover:text-white dark:hover:text-white light:hover:text-slate-900 transition-colors"
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[#0A0D14] dark:bg-[#0A0D14] light:bg-slate-50 px-5 shrink-0">
            <button
              type="button"
              onClick={() => {
                playSound("tab", soundEnabled);
                setActiveTab("profile");
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center gap-2 py-3 px-1 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === "profile"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-400 dark:text-zinc-400 light:text-slate-500 hover:text-white dark:hover:text-white light:hover:text-slate-900"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>Profile &amp; Identity</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playSound("tab", soundEnabled);
                setActiveTab("security");
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === "security"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-400 dark:text-zinc-400 light:text-slate-500 hover:text-white dark:hover:text-white light:hover:text-slate-900"
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Security &amp; Password</span>
            </button>
          </div>

          {/* Feedback alerts */}
          {errorMsg && (
            <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-400 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="flex-1">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-400 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="flex-1">{successMsg}</span>
            </div>
          )}

          {/* Scrollable Body Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {activeTab === "profile" ? (
              /* Profile Tab */
              <div className="space-y-6">
                {/* Avatar & Header Card */}
                <div className="p-4 rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[#07090E] dark:bg-[#07090E] light:bg-slate-50 flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 font-bold text-xl select-none shrink-0 shadow-sm">
                    {getUserInitials()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-white dark:text-white light:text-slate-900 truncate">
                      {displayName || "FinanceOS User"}
                    </h4>
                    <p className="text-xs text-zinc-400 dark:text-zinc-400 light:text-slate-500 truncate mt-0.5">
                      {user?.email}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          user?.emailVerified
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {user?.emailVerified ? (
                          <>
                            <Check className="h-2.5 w-2.5" />
                            <span>Verified</span>
                          </>
                        ) : (
                          <span>Unverified</span>
                        )}
                      </span>

                      {user?.isDemo && (
                        <span className="rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                          Demo Mode
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Display Name Edit Form */}
                <form onSubmit={handleSaveProfile} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 dark:text-zinc-300 light:text-slate-700 mb-1.5">
                      Display Name
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your full name or callsign"
                        className="w-full bg-[#07090E] dark:bg-[#07090E] light:bg-slate-50 border border-white/10 dark:border-white/10 light:border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-white dark:text-white light:text-slate-900 placeholder:text-zinc-500 focus:border-emerald-500 outline-none transition-colors"
                        required
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-500 light:text-slate-400 mt-1">
                      This name is shown across your personal dashboard and ledger greetings.
                    </p>
                  </div>
                </form>

                {/* Account Metadata */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-zinc-400 dark:text-zinc-400 light:text-slate-500 uppercase tracking-wider">
                    Account Details
                  </h4>

                  <div className="rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[#07090E] dark:bg-[#07090E] light:bg-slate-50 divide-y divide-white/[0.06] dark:divide-white/[0.06] light:divide-slate-200 text-xs">
                    <div className="flex items-center justify-between p-3">
                      <span className="text-zinc-400 dark:text-zinc-400 light:text-slate-500 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Member Since</span>
                      </span>
                      <span className="font-mono-num text-white dark:text-white light:text-slate-900 font-medium">
                        {formatTimestamp(user?.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3">
                      <span className="text-zinc-400 dark:text-zinc-400 light:text-slate-500 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Last Sign In</span>
                      </span>
                      <span className="font-mono-num text-white dark:text-white light:text-slate-900 font-medium">
                        {formatTimestamp(user?.lastSignInAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3">
                      <span className="text-zinc-400 dark:text-zinc-400 light:text-slate-500 flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5" />
                        <span>User UID</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono-num text-[11px] text-zinc-400 dark:text-zinc-400 light:text-slate-600 truncate max-w-[130px]">
                          {user?.uid}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyUid}
                          className="p-1 text-zinc-400 hover:text-emerald-400 transition-colors rounded"
                          title="Copy UID"
                        >
                          {copiedUid ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Session Sign Out */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 p-2.5 text-xs font-semibold text-rose-400 transition-colors min-h-[40px]"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out of Account</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Security Tab */
              <div className="space-y-6">
                {/* Email Address Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-emerald-500" />
                      <h4 className="text-xs font-semibold text-white dark:text-white light:text-slate-900">
                        Email Address
                      </h4>
                    </div>

                    {!user?.emailVerified && (
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={isResendingVerification}
                        className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                      >
                        <Send className="h-3 w-3" />
                        <span>{isResendingVerification ? "Sending..." : "Resend Verification"}</span>
                      </button>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[#07090E] dark:bg-[#07090E] light:bg-slate-50 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-white dark:text-white light:text-slate-900">
                        {user?.email}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-500 light:text-slate-400 mt-0.5">
                        {user?.emailVerified
                          ? "Verified primary address for security alerts and sync"
                          : "Unverified address — verify to ensure account recovery"}
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        user?.emailVerified
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {user?.emailVerified ? "Verified" : "Unverified"}
                    </span>
                  </div>

                  {/* Change Email Sub-Form */}
                  <form
                    onSubmit={handleChangeEmail}
                    className="p-3.5 rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[#0A0D14] dark:bg-[#0A0D14] light:bg-slate-50 space-y-3"
                  >
                    <div className="text-xs font-semibold text-zinc-300 dark:text-zinc-300 light:text-slate-700">
                      Change Email Address
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 dark:text-zinc-400 light:text-slate-600 mb-1">
                        New Email Address
                      </label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="new.email@example.com"
                        className="w-full bg-[#07090E] dark:bg-[#07090E] light:bg-white border border-white/10 dark:border-white/10 light:border-slate-200 rounded-xl px-3 py-2 text-xs text-white dark:text-white light:text-slate-900 placeholder:text-zinc-500 focus:border-emerald-500 outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 dark:text-zinc-400 light:text-slate-600 mb-1">
                        Current Password (Required for Re-authentication)
                      </label>
                      <input
                        type="password"
                        value={emailCurrentPassword}
                        onChange={(e) => setEmailCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#07090E] dark:bg-[#07090E] light:bg-white border border-white/10 dark:border-white/10 light:border-slate-200 rounded-xl px-3 py-2 text-xs text-white dark:text-white light:text-slate-900 placeholder:text-zinc-500 focus:border-emerald-500 outline-none transition-colors"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isUpdatingEmail || !newEmail.trim() || !emailCurrentPassword}
                      className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2 text-xs font-semibold text-white transition-all disabled:opacity-40 min-h-[36px]"
                    >
                      {isUpdatingEmail ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Verifying &amp; Updating...</span>
                        </>
                      ) : (
                        <span>Verify &amp; Update Email</span>
                      )}
                    </button>
                  </form>
                </div>

                {/* Change Password Section */}
                <div className="pt-4 border-t border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-emerald-500" />
                    <h4 className="text-xs font-semibold text-white dark:text-white light:text-slate-900">
                      Update Account Password
                    </h4>
                  </div>

                  <form onSubmit={handleChangePassword} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 dark:text-zinc-400 light:text-slate-600 mb-1">
                        Current Password
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={showCurrentPass ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-[#07090E] dark:bg-[#07090E] light:bg-slate-50 border border-white/10 dark:border-white/10 light:border-slate-200 rounded-xl px-3 py-2 text-xs text-white dark:text-white light:text-slate-900 placeholder:text-zinc-500 focus:border-emerald-500 outline-none transition-colors pr-9"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPass(!showCurrentPass)}
                          className="absolute right-3 text-zinc-500 hover:text-zinc-300"
                        >
                          {showCurrentPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 dark:text-zinc-400 light:text-slate-600 mb-1">
                          New Password
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type={showNewPass ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Min. 8 characters"
                            className="w-full bg-[#07090E] dark:bg-[#07090E] light:bg-slate-50 border border-white/10 dark:border-white/10 light:border-slate-200 rounded-xl px-3 py-2 text-xs text-white dark:text-white light:text-slate-900 placeholder:text-zinc-500 focus:border-emerald-500 outline-none transition-colors pr-9"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPass(!showNewPass)}
                            className="absolute right-3 text-zinc-500 hover:text-zinc-300"
                          >
                            {showNewPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 dark:text-zinc-400 light:text-slate-600 mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type={showNewPass ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter password"
                          className="w-full bg-[#07090E] dark:bg-[#07090E] light:bg-slate-50 border border-white/10 dark:border-white/10 light:border-slate-200 rounded-xl px-3 py-2 text-xs text-white dark:text-white light:text-slate-900 placeholder:text-zinc-500 focus:border-emerald-500 outline-none transition-colors"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isUpdatingPassword || !currentPassword || !newPassword || !confirmPassword}
                      className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-semibold text-white transition-all disabled:opacity-40 min-h-[38px]"
                    >
                      {isUpdatingPassword ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <span>Save New Password</span>
                      )}
                    </button>
                  </form>
                </div>

                {/* Passcode / PIN Quick Access */}
                <div className="pt-4 border-t border-white/[0.08] dark:border-white/[0.08] light:border-slate-200">
                  <div className="p-3.5 rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[#07090E] dark:bg-[#07090E] light:bg-slate-50 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white dark:text-white light:text-slate-900">
                        <KeyRound className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Security Passcode (4-6 Digits)</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-400 light:text-slate-500 mt-0.5">
                        Local device unlock code used for fast biometric &amp; tab return authentication.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        playSound("click", soundEnabled);
                        setIsPinModalOpen(true);
                      }}
                      className="shrink-0 flex items-center gap-1.5 rounded-xl border border-white/10 dark:border-white/10 light:border-slate-300 bg-white/5 dark:bg-white/5 light:bg-white px-3 py-2 text-xs font-semibold text-white dark:text-white light:text-slate-900 hover:border-emerald-500/50 transition-colors min-h-[36px]"
                    >
                      <KeyRound className="h-3 w-3" />
                      <span>Configure Passcode</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="border-t border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 px-5 py-3.5 bg-[#0A0D14] dark:bg-[#0A0D14] light:bg-slate-50 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={() => {
                playSound("click", soundEnabled);
                onClose();
              }}
              className="rounded-xl border border-white/10 dark:border-white/10 light:border-slate-300 bg-transparent px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white dark:hover:text-white light:hover:text-slate-900 transition-colors min-h-[38px]"
            >
              Close
            </button>

            {activeTab === "profile" && (
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2 text-xs font-semibold text-white transition-all shadow-sm disabled:opacity-50 min-h-[38px]"
              >
                {isSavingProfile ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sub-Modal: PIN Settings */}
      <PinSettingsModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
      />
    </>
  );
};
