"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, isFirebaseConfigured } from "../firebase/config";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";
import {
  closeUserDatabase,
  getDatabaseForUser,
  setActiveUserDatabase,
} from "../db/dexie";
import { initializeDatabaseIfEmpty } from "../db/syncEngine";

export interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
  isDemo?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithDemoOperative: (id: "operative_a" | "operative_b") => Promise<void>;
  verifyPassword: (password: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_SESSION_KEY = "financeos_v2_active_session";
const LOCAL_USERS_KEY = "financeos_v2_mock_accounts";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize Auth state
  useEffect(() => {
    // 1. Check local session cache first
    try {
      const cached = localStorage.getItem(LOCAL_SESSION_KEY);
      if (cached) {
        const parsed: AuthUser = JSON.parse(cached);
        setUser(parsed);
        setActiveUserDatabase(parsed.uid);
        if (parsed.isDemo) {
          initializeDatabaseIfEmpty(parsed.uid, true).catch(console.error);
        }
      }
    } catch {
      // Ignore parse error
    }

    // 2. If Firebase Auth is available, subscribe
    if (auth && isFirebaseConfigured) {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
        if (fbUser) {
          const authUser: AuthUser = {
            uid: fbUser.uid,
            email: fbUser.email || "user@financeos.local",
            displayName: fbUser.displayName || fbUser.email?.split("@")[0] || "Operative",
          };
          setUser(authUser);
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(authUser));
          setActiveUserDatabase(authUser.uid);
          // Note: Real Firebase tenants are hydrated downstream from Firestore in AuthGate -> initFirestoreSync
        } else {
          // If no local demo user either, clear user
          const cached = localStorage.getItem(LOCAL_SESSION_KEY);
          if (!cached || !JSON.parse(cached).isDemo) {
            setUser(null);
            localStorage.removeItem(LOCAL_SESSION_KEY);
          }
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, pass: string) => {
    setLoading(true);
    try {
      if (auth && isFirebaseConfigured) {
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        const authUser: AuthUser = {
          uid: cred.user.uid,
          email: cred.user.email || email,
          displayName: cred.user.displayName || email.split("@")[0],
        };
        setUser(authUser);
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(authUser));
        setActiveUserDatabase(authUser.uid);
      } else {
        // Local offline multi-tenant account verification
        const mockAccounts: Record<string, { pass: string; name: string }> = JSON.parse(
          localStorage.getItem(LOCAL_USERS_KEY) || "{}"
        );
        const account = mockAccounts[email.toLowerCase()];

        if (account) {
          if (account.pass !== pass) {
            throw new Error("Invalid password provided for this operative");
          }
        } else {
          // Register automatically in offline demo mode if not present
          mockAccounts[email.toLowerCase()] = {
            pass,
            name: email.split("@")[0],
          };
          localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(mockAccounts));
        }

        const uid = `usr_${btoa(email.toLowerCase()).replace(/[^a-zA-Z0-9]/g, "").substring(0, 16)}`;
        const authUser: AuthUser = {
          uid,
          email,
          displayName: email.split("@")[0],
        };
        setUser(authUser);
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(authUser));
        setActiveUserDatabase(authUser.uid);
        await initializeDatabaseIfEmpty(authUser.uid, false);
      }
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, pass: string, displayName?: string) => {
    setLoading(true);
    try {
      if (auth && isFirebaseConfigured) {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        const authUser: AuthUser = {
          uid: cred.user.uid,
          email: cred.user.email || email,
          displayName: displayName || email.split("@")[0],
        };
        setUser(authUser);
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(authUser));
        setActiveUserDatabase(authUser.uid);
      } else {
        const mockAccounts: Record<string, { pass: string; name: string }> = JSON.parse(
          localStorage.getItem(LOCAL_USERS_KEY) || "{}"
        );

        if (mockAccounts[email.toLowerCase()]) {
          throw new Error("An operative with this email is already registered");
        }

        mockAccounts[email.toLowerCase()] = {
          pass,
          name: displayName || email.split("@")[0],
        };
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(mockAccounts));

        const uid = `usr_${btoa(email.toLowerCase()).replace(/[^a-zA-Z0-9]/g, "").substring(0, 16)}`;
        const authUser: AuthUser = {
          uid,
          email,
          displayName: displayName || email.split("@")[0],
        };
        setUser(authUser);
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(authUser));
        setActiveUserDatabase(authUser.uid);
        await initializeDatabaseIfEmpty(authUser.uid, false);
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithDemoOperative = async (id: "operative_a" | "operative_b") => {
    setLoading(true);
    try {
      const isOperativeA = id === "operative_a";
      const authUser: AuthUser = {
        uid: isOperativeA ? "demo_operative_alpha" : "demo_operative_beta",
        email: isOperativeA ? "operative.alpha@tokyo.net" : "operative.beta@tokyo.net",
        displayName: isOperativeA ? "Kenji (Cyber Operative A)" : "Rei (Cyber Operative B)",
        isDemo: true,
      };

      setUser(authUser);
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(authUser));
      setActiveUserDatabase(authUser.uid);
      await initializeDatabaseIfEmpty(authUser.uid, isOperativeA);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      if (auth && isFirebaseConfigured) {
        await firebaseSignOut(auth).catch(() => {});
      }
      await closeUserDatabase();
      setUser(null);
      localStorage.removeItem(LOCAL_SESSION_KEY);
    } finally {
      setLoading(false);
    }
  };

  const verifyPassword = async (password: string): Promise<boolean> => {
    if (!user) return false;

    if (user.isDemo) {
      // In demo mode, accept demo password or standard unlock
      return password === "password" || password === "123456" || password === "1337";
    }

    if (auth && isFirebaseConfigured) {
      try {
        // Reauthenticate with Firebase
        await signInWithEmailAndPassword(auth, user.email, password);
        return true;
      } catch {
        return false;
      }
    } else {
      const mockAccounts: Record<string, { pass: string; name: string }> = JSON.parse(
        localStorage.getItem(LOCAL_USERS_KEY) || "{}"
      );
      const acc = mockAccounts[user.email.toLowerCase()];
      return acc ? acc.pass === password : password === "password";
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        signInWithDemoOperative,
        verifyPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
