import "fake-indexeddb/auto";
import assert from "node:assert";
import test from "node:test";
import { executeNuclearReset } from "./resetEngine";
import { getDatabaseForUser } from "./dexie";
import { initializeDatabaseIfEmpty } from "./syncEngine";
import { hashPin, generateSalt, verifyPin } from "../security";

test("executeNuclearReset wipes transactions and reseeds baseline while preserving custom PIN", async () => {
  const testUserId = "test_operative_nuclear_wipe";
  const userDb = getDatabaseForUser(testUserId);

  // 1. Initialize with demo transactions
  await initializeDatabaseIfEmpty(testUserId, true);
  const txCountBefore = await userDb.transactions.count();
  assert.ok(txCountBefore > 0, "Transactions should exist before wipe");

  // 2. Set custom PIN '7777'
  const salt = generateSalt();
  const hash = await hashPin("7777", salt);
  const settings = await userDb.settings.get("main");
  assert.ok(settings, "Settings should exist");
  settings.security = {
    pinHash: hash,
    pinSalt: salt,
    isPinSet: true,
    autoLockTimeoutMinutes: 5,
    biometricsEnabled: false,
    lastUnlockedAt: Date.now(),
  };
  await userDb.settings.put(settings);

  // 3. Execute Nuclear Reset
  await executeNuclearReset(testUserId);

  // 4. Verify all transactions wiped
  const txCountAfter = await userDb.transactions.count();
  assert.strictEqual(txCountAfter, 0, "Transactions should be 0 after reset");

  // 5. Verify baseline accounts reseeded with 0 balance
  const accounts = await userDb.accounts.toArray();
  assert.strictEqual(accounts.length, 2, "Should reseed 2 baseline accounts");
  assert.strictEqual(accounts[0].currentBalance, 0, "Account balance should be 0");
  assert.strictEqual(accounts[1].currentBalance, 0, "Account balance should be 0");

  // 6. Verify categories exist
  const catCount = await userDb.categories.count();
  assert.ok(catCount > 0, "Baseline categories should exist");

  // 7. Verify custom PIN 7777 was preserved
  const updatedSettings = await userDb.settings.get("main");
  assert.strictEqual(updatedSettings?.security?.isPinSet, true, "PIN should remain set");
  const isCustomPinValid = await verifyPin(
    "7777",
    updatedSettings?.security?.pinHash || "",
    updatedSettings?.security?.pinSalt || ""
  );
  assert.strictEqual(isCustomPinValid, true, "Custom PIN 7777 must remain valid after reset");
});
