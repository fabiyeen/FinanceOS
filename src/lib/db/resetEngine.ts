import { db, getDatabaseForUser } from "./dexie";
import { firestore, isFirebaseConfigured } from "../firebase/config";
import { collection, getDocs, writeBatch } from "firebase/firestore";
import {
  FACTORY_BASELINE_ACCOUNTS,
  SEED_CATEGORIES,
  SEED_SETTINGS,
} from "./seedData";
import { createDefaultSecuritySettings } from "../security";

/**
 * Destructive nuclear reset engine
 * Wipes all ledger transactions, debts, recurring schedules, vaults, and accounts
 * for the given user, while strictly preserving their authentication identity and PIN.
 */
export async function executeNuclearReset(userId: string): Promise<void> {
  const userDb = getDatabaseForUser(userId);

  // 1. Fetch current security settings to preserve PIN configuration
  let currentSecurity = SEED_SETTINGS.security;
  try {
    const existingSettings = await userDb.settings.get("main");
    if (existingSettings?.security) {
      currentSecurity = existingSettings.security;
    } else {
      currentSecurity = await createDefaultSecuritySettings();
    }
  } catch {
    currentSecurity = await createDefaultSecuritySettings();
  }

  // 2. Atomic wipe of all IndexedDB ledger tables
  await userDb.transaction(
    "rw",
    [
      userDb.transactions,
      userDb.accounts,
      userDb.debts,
      userDb.recurring,
      userDb.vaults,
      userDb.categories,
      userDb.syncQueue,
      userDb.settings,
    ],
    async () => {
      await userDb.transactions.clear();
      await userDb.accounts.clear();
      await userDb.debts.clear();
      await userDb.recurring.clear();
      await userDb.vaults.clear();
      await userDb.categories.clear();
      await userDb.syncQueue.clear();
      await userDb.settings.clear();

      // 3. Reseed factory baseline data (Zero-balance fresh accounts and standard categories)
      await userDb.categories.bulkAdd(SEED_CATEGORIES);
      await userDb.accounts.bulkAdd(FACTORY_BASELINE_ACCOUNTS);
      await userDb.settings.put({
        ...SEED_SETTINGS,
        id: "main",
        security: currentSecurity,
      });
    }
  );


// 4. If Firestore is active and configured, wipe remote subcollections
  if (firestore && isFirebaseConfigured && userId && userId !== "default") {
    const subcollections = [
      "accounts",
      "transactions",
      "debts",
      "recurring",
      "vaults",
      "categories",
      "tags",
      "syncQueue",
    ];

    for (const sub of subcollections) {
      try {
        const colRef = collection(firestore, `users/${userId}/${sub}`);
        const snapshot = await getDocs(colRef);
        if (!snapshot.empty) {
          const batch = writeBatch(firestore);
          snapshot.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (err) {
        console.warn(`[Nuclear Reset] Firestore clean warning on ${sub}:`, err);
      }
    }

    // Reseed fresh factory baseline accounts, categories, and settings to Firestore
    try {
      const { syncAllLocalDataToFirestore } = await import("./syncEngine");
      await syncAllLocalDataToFirestore(userId);
    } catch (err) {
      console.warn("[Nuclear Reset] Firestore baseline reseed warning:", err);
    }
  }
}
