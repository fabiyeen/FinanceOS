"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { ThemeMode, UserSettings } from "../../lib/types";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "../../lib/auth/authContext";
import { firestore } from "../../lib/firebase/config";
import { doc, setDoc } from "firebase/firestore";

interface ThemeContextType {
  theme: ThemeMode;
  effectiveTheme: "light" | "dark" | "midnight-oled";
  setTheme: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  effectiveTheme: "dark",
  setTheme: async () => {},
});

export const useTheme = () => useContext(ThemeContext);

function normalizeTheme(theme: string | undefined): ThemeMode {
  if (theme === "clean-paper" || theme === "light") return "light";
  if (theme === "pitch-oled" || theme === "midnight-oled") return "midnight-oled";
  if (theme === "system") return "system";
  return "dark"; // Default dark
}

function resolveEffectiveTheme(theme: ThemeMode): "light" | "dark" | "midnight-oled" {
  if (theme === "system") {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
    return "dark";
  }
  return theme;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const dbSettings = useLiveQuery(() => db.settings.get("main"));

  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("financeos_theme");
      if (cached) return normalizeTheme(cached);
    }
    return "dark";
  });

  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark" | "midnight-oled">(() =>
    resolveEffectiveTheme(theme)
  );

  // Sync with dbSettings if available
  useEffect(() => {
    if (dbSettings?.theme) {
      const normalized = normalizeTheme(dbSettings.theme);
      setThemeState(normalized);
    }
  }, [dbSettings?.theme]);

  // Apply classes to root element
  const applyThemeToDOM = useCallback((targetEffective: "light" | "dark" | "midnight-oled") => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("light", "dark", "midnight-oled");
    root.classList.add(targetEffective);
    
    // Update theme-color meta tag
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      const color =
        targetEffective === "light"
          ? "#F9FAFB"
          : targetEffective === "midnight-oled"
          ? "#000000"
          : "#0B0F17";
      metaTheme.setAttribute("content", color);
    }
  }, []);

  // Recalculate effective theme whenever theme changes or system changes
  useEffect(() => {
    const computed = resolveEffectiveTheme(theme);
    setEffectiveTheme(computed);
    applyThemeToDOM(computed);

    if (typeof window !== "undefined") {
      localStorage.setItem("financeos_theme", theme);
    }

    // Listener for system mode preference change
    if (theme === "system" && typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = (e: MediaQueryListEvent) => {
        const newEff = e.matches ? "dark" : "light";
        setEffectiveTheme(newEff);
        applyThemeToDOM(newEff);
      };
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme, applyThemeToDOM]);

  const setTheme = useCallback(
    async (newTheme: ThemeMode) => {
      setThemeState(newTheme);
      const computed = resolveEffectiveTheme(newTheme);
      setEffectiveTheme(computed);
      applyThemeToDOM(computed);

      if (typeof window !== "undefined") {
        localStorage.setItem("financeos_theme", newTheme);
      }

      // Persist to Dexie
      try {
        const existing = await db.settings.get("main");
        if (existing) {
          await db.settings.put({
            ...existing,
            theme: newTheme,
          });
        }
      } catch (err) {
        console.warn("[ThemeProvider] Failed to update local settings:", err);
      }

      // Persist to Firestore if user is authenticated
      if (firestore && user?.uid && !user.isDemo) {
        try {
          const docRef = doc(firestore, `users/${user.uid}/settings/main`);
          await setDoc(docRef, { theme: newTheme }, { merge: true });
        } catch (err) {
          console.warn("[ThemeProvider] Failed to update Firestore settings:", err);
        }
      }
    },
    [applyThemeToDOM, user]
  );

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
