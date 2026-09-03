import assert from "node:assert";
import test from "node:test";
import {
  createDefaultSecuritySettings,
  DEFAULT_FALLBACK_PIN,
  generateSalt,
  hashPin,
  verifyPin,
} from "./security";

test("generateSalt returns 32-character hex string", () => {
  const salt1 = generateSalt();
  const salt2 = generateSalt();
  assert.strictEqual(salt1.length, 32);
  assert.strictEqual(salt2.length, 32);
  assert.notStrictEqual(salt1, salt2);
});

test("hashPin and verifyPin validate correct PIN", async () => {
  const salt = generateSalt();
  const hash = await hashPin("1337", salt);

  assert.strictEqual(typeof hash, "string");
  assert.strictEqual(hash.length, 64); // 256 bits = 64 hex chars

  const isValid = await verifyPin("1337", hash, salt);
  assert.strictEqual(isValid, true);

  const isInvalid = await verifyPin("9999", hash, salt);
  assert.strictEqual(isInvalid, false);
});

test("Default fallback PIN 0000 works out of the box", async () => {
  const sec = await createDefaultSecuritySettings();
  assert.strictEqual(sec.isPinSet, false);
  assert.strictEqual(sec.autoLockTimeoutMinutes, 5);

  const isDefaultValid = await verifyPin(DEFAULT_FALLBACK_PIN, sec.pinHash, sec.pinSalt);
  assert.strictEqual(isDefaultValid, true);

  const isWrongValid = await verifyPin("1234", sec.pinHash, sec.pinSalt);
  assert.strictEqual(isWrongValid, false);
});
