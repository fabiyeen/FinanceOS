import { UserSecuritySettings } from "./types";

export const DEFAULT_FALLBACK_PIN = "0000";

/**
 * Generates a random 16-byte hexadecimal salt
 */
export function generateSalt(): string {
  const cryptoObj = typeof window !== "undefined" ? window.crypto : globalThis.crypto;
  const bytes = new Uint8Array(16);
  cryptoObj.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Hashes a PIN using Web Crypto SHA-256 with a salt
 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const cryptoObj = typeof window !== "undefined" ? window.crypto : globalThis.crypto;
  const encoder = new TextEncoder();
  const data = encoder.encode(`${pin}:${salt}`);
  const hashBuffer = await cryptoObj.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verifies if an entered PIN matches the stored salted hash
 */
export async function verifyPin(
  inputPin: string,
  storedHash: string,
  salt: string
): Promise<boolean> {
  if (!inputPin || !storedHash || !salt) return false;
  const computed = await hashPin(inputPin, salt);
  return computed === storedHash;
}

/**
 * Creates default initial security configuration with fallback PIN 0000
 */
export async function createDefaultSecuritySettings(): Promise<UserSecuritySettings> {
  const salt = generateSalt();
  const hash = await hashPin(DEFAULT_FALLBACK_PIN, salt);

  return {
    pinHash: hash,
    pinSalt: salt,
    isPinSet: false, // Indicates user has not customized from 0000 yet
    autoLockTimeoutMinutes: 5,
    biometricsEnabled: false,
    lastUnlockedAt: Date.now(),
  };
}
