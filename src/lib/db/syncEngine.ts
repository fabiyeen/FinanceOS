import { applyTransaction } from "../mathEngine";
import {
  Account,
  Category,
  Debt,
  RecurringRule,
  SyncQueueItem,
  Transaction,
  UserSettings,
  Vault,
} from "../types";
import { db, getDatabaseForUser, getCurrentActiveUserId } from "./dexie";
import {
  generateSeedTransactions,
  SEED_ACCOUNTS,
  SEED_CATEGORIES,
  SEED_DEBTS,
  SEED_RECURRING,
  SEED_SETTINGS,
  SEED_VAULTS,
  FACTORY_BASELINE_ACCOUNTS,
} from "./seedData";
import { createDefaultSecuritySettings } from "../security";
import { firestore } from "../firebase/config";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";

/**
 * Checks whether a user ID is eligible for cloud sync (excludes demo / anonymous guest)
 */
export function isSyncEligible(userId?: string): boolean {
  if (!userId) return false;
  if (userId === "default") return false;
  if (userId.startsWith("demo_")) return false;
  return true;
}

/**
 * Pushes a record to Firestore under users/{userId}/{collectionName}/{docId}.
 * If the client is offline or the call fails, queues the mutation in Dexie syncQueue.
 */
export async function pushToCloud(
  collectionName: "accounts" | "transactions" | "vaults" | "debts" | "categories" | "settings",
  docId: string,
  action: "create" | "update" | "delete",
  payload: Record<string, unknown>,
  userId?: string
): Promise<void> {
  const activeUserId = userId || getCurrentActiveUserId();
  if (!isSyncEligible(activeUserId)) return;

  const isOnline =
    typeof window !== "undefined" && typeof navigator !== "undefined"
      ? navigator.onLine
      : false;

  const userDb = getDatabaseForUser(activeUserId);

  if (isOnline && firestore) {
    try {
      const docRef = doc(firestore, `users/${activeUserId}/${collectionName}/${docId}`);
      if (action === "delete") {
        await deleteDoc(docRef);
      } else {
        await setDoc(docRef, payload, { merge: true });
      }
      return;
    } catch (err) {
      console.warn(`[SyncEngine] Cloud push failed for ${collectionName}/${docId}, queuing offline:`, err);
    }
  }

  // Offline or push failed -> persist in syncQueue table
  try {
    const queueItem: SyncQueueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      action: action === "delete" ? "delete" : "create",
      collection: collectionName,
      payload: action === "delete" ? { id: docId } : payload,
      timestamp: Date.now(),
      status: "pending",
      retryCount: 0,
    };
    await userDb.syncQueue.add(queueItem);
  } catch (err) {
    console.warn("[SyncEngine] Failed to record offline syncQueue item:", err);
  }
}

/**
 * Process pending items in sync queue when connection is restored
 */
export async function drainSyncQueue(
  userId?: string
): Promise<{ processed: number; failed: number }> {
  const activeUserId = userId || getCurrentActiveUserId();
  if (!isSyncEligible(activeUserId)) return { processed: 0, failed: 0 };
  if (typeof window === "undefined" || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return { processed: 0, failed: 0 };
  }
  if (!firestore) return { processed: 0, failed: 0 };

  const userDb = getDatabaseForUser(activeUserId);
  const pendingItems = await userDb.syncQueue
    .where("status")
    .equals("pending")
    .toArray();

  if (pendingItems.length === 0) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;

  for (const item of pendingItems) {
    try {
      const docId = (item.payload as { id?: string })?.id || item.id;
      const docRef = doc(firestore, `users/${activeUserId}/${item.collection}/${docId}`);
      if (item.action === "delete") {
        await deleteDoc(docRef);
      } else {
        await setDoc(docRef, item.payload, { merge: true });
      }
      await userDb.syncQueue.delete(item.id);
      processed++;
    } catch (err) {
      failed++;
      const nextRetry = (item.retryCount || 0) + 1;
      await userDb.syncQueue.update(item.id, {
        retryCount: nextRetry,
        status: nextRetry >= 5 ? "failed" : "pending",
      });
    }
  }

  return { processed, failed };
}

/**
 * Unified Account mutations (Dexie + Firestore + offline queue)
 */
export async function saveAccount(account: Account, userId?: string): Promise<void> {
  const activeUserId = userId || getCurrentActiveUserId();
  const userDb = getDatabaseForUser(activeUserId);
  await userDb.accounts.put(account);
  await pushToCloud("accounts", account.id, "create", account as unknown as Record<string, unknown>, activeUserId);
}

export async function deleteAccount(accountId: string, userId?: string): Promise<void> {
  const activeUserId = userId || getCurrentActiveUserId();
  const userDb = getDatabaseForUser(activeUserId);
  await userDb.accounts.delete(accountId);
  await pushToCloud("accounts", accountId, "delete", { id: accountId }, activeUserId);
}

/**
 * Unified Vault mutations (Dexie + Firestore + offline queue)
 */
export async function saveVault(vault: Vault, userId?: string): Promise<void> {
  const activeUserId = userId || getCurrentActiveUserId();
  const userDb = getDatabaseForUser(activeUserId);
  await userDb.vaults.put(vault);
  await pushToCloud("vaults", vault.id, "create", vault as unknown as Record<string, unknown>, activeUserId);
}

export async function deleteVault(vaultId: string, userId?: string): Promise<void> {
  const activeUserId = userId || getCurrentActiveUserId();
  const userDb = getDatabaseForUser(activeUserId);
  await userDb.vaults.delete(vaultId);
  await pushToCloud("vaults", vaultId, "delete", { id: vaultId }, activeUserId);
}

/**
 * Unified Debt mutations (Dexie + Firestore + offline queue)
 */
export async function saveDebt(debt: Debt, userId?: string): Promise<void> {
  const activeUserId = userId || getCurrentActiveUserId();
  const userDb = getDatabaseForUser(activeUserId);
  await userDb.debts.put(debt);
  await pushToCloud("debts", debt.id, "create", debt as unknown as Record<string, unknown>, activeUserId);
}

export async function deleteDebt(debtId: string, userId?: string): Promise<void> {
  const activeUserId = userId || getCurrentActiveUserId();
  const userDb = getDatabaseForUser(activeUserId);
  await userDb.debts.delete(debtId);
  await pushToCloud("debts", debtId, "delete", { id: debtId }, activeUserId);
}

/**
 * Unified Category mutations (Dexie + Firestore + offline queue)
 */
export async function saveCategory(category: Category, userId?: string): Promise<void> {
  const activeUserId = userId || getCurrentActiveUserId();
  const userDb = getDatabaseForUser(activeUserId);
  await userDb.categories.put(category);
  await pushToCloud("categories", category.id, "create", category as unknown as Record<string, unknown>, activeUserId);
}

export async function deleteCategory(categoryId: string, userId?: string): Promise<void> {
  const activeUserId = userId || getCurrentActiveUserId();
  const userDb = getDatabaseForUser(activeUserId);
  await userDb.categories.delete(categoryId);
  await pushToCloud("categories", categoryId, "delete", { id: categoryId }, activeUserId);
}

/**
 * Unified User Settings mutations
 */
export async function saveSettings(settings: UserSettings, userId?: string): Promise<void> {
  const activeUserId = userId || getCurrentActiveUserId();
  const userDb = getDatabaseForUser(activeUserId);
  await userDb.settings.put({ ...settings, id: "main" });
  await pushToCloud("settings", "main", "create", { ...settings, id: "main" } as unknown as Record<string, unknown>, activeUserId);
}

/**
 * Initializes database for specified user if empty
 */
export async function initializeDatabaseIfEmpty(
  userId: string = "default",
  isDemo: boolean = false
): Promise<boolean> {
  if (typeof window === "undefined" && typeof globalThis.indexedDB === "undefined") return false;

  const userDb = getDatabaseForUser(userId);
  const accountsCount = await userDb.accounts.count();
  if (accountsCount > 0) {
    return false; // Already populated
  }

  const shouldSeedFullDemo = isDemo || userId === "default" || userId.startsWith("demo_");

  await userDb.transaction("rw", [
    userDb.accounts,
    userDb.categories,
    userDb.vaults,
    userDb.debts,
    userDb.recurring,
    userDb.settings,
    userDb.transactions,
  ], async () => {
    await userDb.categories.bulkAdd(SEED_CATEGORIES);

    if (shouldSeedFullDemo) {
      await userDb.accounts.bulkAdd(SEED_ACCOUNTS);
      await userDb.vaults.bulkAdd(SEED_VAULTS);
      await userDb.debts.bulkAdd(SEED_DEBTS);
      await userDb.recurring.bulkAdd(SEED_RECURRING);
      await userDb.settings.put({ ...SEED_SETTINGS, id: "main" });
      await userDb.transactions.bulkAdd(generateSeedTransactions());
    } else {
      // Clean factory baseline for real user
      const defaultSec = await createDefaultSecuritySettings();
      await userDb.accounts.bulkAdd(FACTORY_BASELINE_ACCOUNTS);
      await userDb.settings.put({
        ...SEED_SETTINGS,
        id: "main",
        security: defaultSec,
      });
    }
  });

  if (!shouldSeedFullDemo && isSyncEligible(userId)) {
    syncAllLocalDataToFirestore(userId).catch((err) => {
      console.warn("[SyncEngine] Background initial baseline sync notice:", err);
    });
  }

  return true;
}

/**
 * Pushes all current local Dexie data to Firestore
 */
export async function syncAllLocalDataToFirestore(userId: string): Promise<void> {
  if (!isSyncEligible(userId) || !firestore) return;
  const userDb = getDatabaseForUser(userId);

  try {
    const [localAccounts, localCategories, localVaults, localDebts, localTransactions, localSettings] =
      await Promise.all([
        userDb.accounts.toArray(),
        userDb.categories.toArray(),
        userDb.vaults.toArray(),
        userDb.debts.toArray(),
        userDb.transactions.toArray(),
        userDb.settings.get("main"),
      ]);

    for (const a of localAccounts) {
      await pushToCloud("accounts", a.id, "create", a as unknown as Record<string, unknown>, userId);
    }
    for (const c of localCategories) {
      await pushToCloud("categories", c.id, "create", c as unknown as Record<string, unknown>, userId);
    }
    for (const v of localVaults) {
      await pushToCloud("vaults", v.id, "create", v as unknown as Record<string, unknown>, userId);
    }
    for (const d of localDebts) {
      await pushToCloud("debts", d.id, "create", d as unknown as Record<string, unknown>, userId);
    }
    for (const t of localTransactions) {
      await pushToCloud("transactions", t.id, "create", t as unknown as Record<string, unknown>, userId);
    }
    if (localSettings) {
      await pushToCloud("settings", "main", "create", localSettings as unknown as Record<string, unknown>, userId);
    }
  } catch (err) {
    console.warn("[SyncEngine] Error syncing local data to Firestore:", err);
  }
}

/**
 * Adds a transaction with zero-sum ledger integrity and pushes to cloud (or syncQueue)
 */
export async function addTransactionWithLedgerSync(
  txData: Omit<Transaction, "id" | "createdAt" | "updatedAt"> & { id?: string },
  userId?: string
): Promise<{ transaction: Transaction; error?: string }> {
  const activeUserId = userId || getCurrentActiveUserId();
  const userDb = getDatabaseForUser(activeUserId);

  const id = txData.id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const transaction: Transaction = {
    ...txData,
    id,
    createdAt: now,
    updatedAt: now,
  };

  const accounts = await userDb.accounts.toArray();
  const vaults = await userDb.vaults.toArray();
  const debts = await userDb.debts.toArray();

  const result = applyTransaction(transaction, accounts, vaults, debts);

  if (result.error) {
    return { transaction, error: result.error };
  }

  await userDb.transaction("rw", [
    userDb.transactions,
    userDb.accounts,
    userDb.vaults,
    userDb.debts,
  ], async () => {
    await userDb.transactions.add(transaction);
    await userDb.accounts.bulkPut(result.accounts);
    await userDb.vaults.bulkPut(result.vaults);
    await userDb.debts.bulkPut(result.debts);
  });

  // Upstream sync to Firestore
  await pushToCloud("transactions", transaction.id, "create", transaction as unknown as Record<string, unknown>, activeUserId);

  for (const acc of result.accounts) {
    await pushToCloud("accounts", acc.id, "update", acc as unknown as Record<string, unknown>, activeUserId);
  }
  for (const v of result.vaults) {
    await pushToCloud("vaults", v.id, "update", v as unknown as Record<string, unknown>, activeUserId);
  }
  for (const d of result.debts) {
    await pushToCloud("debts", d.id, "update", d as unknown as Record<string, unknown>, activeUserId);
  }

  return { transaction };
}

/**
 * Deletes a transaction, reverses its ledger effects, and syncs deletion to cloud
 */
export async function deleteTransactionWithLedgerSync(
  txId: string,
  userId?: string
): Promise<boolean> {
  const activeUserId = userId || getCurrentActiveUserId();
  const userDb = getDatabaseForUser(activeUserId);

  const tx = await userDb.transactions.get(txId);
  if (!tx) return false;

  // Reverse transaction effect
  let reverseType = tx.type;
  if (tx.type === "expense") reverseType = "income";
  else if (tx.type === "income") reverseType = "expense";
  else if (tx.type === "transfer") {
    const temp = tx.fromAccountId;
    tx.fromAccountId = tx.toAccountId || "";
    tx.toAccountId = temp;
  } else if (tx.type === "vault_deposit") {
    reverseType = "vault_withdraw";
  } else if (tx.type === "vault_withdraw") {
    reverseType = "vault_deposit";
  }

  const reverseTx: Transaction = {
    ...tx,
    type: reverseType,
  };

  const accounts = await userDb.accounts.toArray();
  const vaults = await userDb.vaults.toArray();
  const debts = await userDb.debts.toArray();

  const result = applyTransaction(reverseTx, accounts, vaults, debts);

  await userDb.transaction("rw", [
    userDb.transactions,
    userDb.accounts,
    userDb.vaults,
    userDb.debts,
  ], async () => {
    await userDb.transactions.delete(txId);
    if (!result.error) {
      await userDb.accounts.bulkPut(result.accounts);
      await userDb.vaults.bulkPut(result.vaults);
      await userDb.debts.bulkPut(result.debts);
    }
  });

  // Upstream sync deletion and affected balances to cloud
  await pushToCloud("transactions", txId, "delete", { id: txId }, activeUserId);

  if (!result.error) {
    for (const acc of result.accounts) {
      await pushToCloud("accounts", acc.id, "update", acc as unknown as Record<string, unknown>, activeUserId);
    }
    for (const v of result.vaults) {
      await pushToCloud("vaults", v.id, "update", v as unknown as Record<string, unknown>, activeUserId);
    }
    for (const d of result.debts) {
      await pushToCloud("debts", d.id, "update", d as unknown as Record<string, unknown>, activeUserId);
    }
  }

  return true;
}

/**
 * Hydrates local Dexie tables from Firestore cloud documents.
 * Merges missing records bidirectionally.
 */
export async function hydrateFromFirestore(userId: string): Promise<boolean> {
  if (typeof window === "undefined" || !isSyncEligible(userId) || !firestore) {
    return false;
  }

  const userDb = getDatabaseForUser(userId);

  try {
    const [
      accountsSnap,
      transactionsSnap,
      vaultsSnap,
      debtsSnap,
      categoriesSnap,
      settingsSnap,
    ] = await Promise.all([
      getDocs(collection(firestore, `users/${userId}/accounts`)),
      getDocs(collection(firestore, `users/${userId}/transactions`)),
      getDocs(collection(firestore, `users/${userId}/vaults`)),
      getDocs(collection(firestore, `users/${userId}/debts`)),
      getDocs(collection(firestore, `users/${userId}/categories`)),
      getDocs(collection(firestore, `users/${userId}/settings`)),
    ]);

    const hasAnyRemoteData =
      !accountsSnap.empty ||
      !transactionsSnap.empty ||
      !vaultsSnap.empty ||
      !debtsSnap.empty ||
      !categoriesSnap.empty;

    if (hasAnyRemoteData) {
      // 1. Seed remote Firestore records into local Dexie tables
      if (!accountsSnap.empty) {
        const remoteAccounts = accountsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Account));
        await userDb.accounts.bulkPut(remoteAccounts);
      }
      if (!transactionsSnap.empty) {
        const remoteTxs = transactionsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));
        await userDb.transactions.bulkPut(remoteTxs);
      }
      if (!vaultsSnap.empty) {
        const remoteVaults = vaultsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Vault));
        await userDb.vaults.bulkPut(remoteVaults);
      }
      if (!debtsSnap.empty) {
        const remoteDebts = debtsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Debt));
        await userDb.debts.bulkPut(remoteDebts);
      }
      if (!categoriesSnap.empty) {
        const remoteCategories = categoriesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
        await userDb.categories.bulkPut(remoteCategories);
      }
      if (!settingsSnap.empty) {
        const mainSetting = settingsSnap.docs.find((d) => d.id === "main");
        if (mainSetting) {
          await userDb.settings.put({ ...mainSetting.data(), id: "main" } as UserSettings & { id: string });
        }
      }

      // 2. Also ensure local records not present in Firestore are pushed up (e.g. created offline prior)
      const remoteAccountIds = new Set(accountsSnap.docs.map((d) => d.id));
      const localAccounts = await userDb.accounts.toArray();
      for (const acc of localAccounts) {
        if (!remoteAccountIds.has(acc.id)) {
          await pushToCloud("accounts", acc.id, "create", acc as unknown as Record<string, unknown>, userId);
        }
      }

      const remoteCatIds = new Set(categoriesSnap.docs.map((d) => d.id));
      const localCategories = await userDb.categories.toArray();
      for (const cat of localCategories) {
        if (!remoteCatIds.has(cat.id)) {
          await pushToCloud("categories", cat.id, "create", cat as unknown as Record<string, unknown>, userId);
        }
      }

      const remoteTxIds = new Set(transactionsSnap.docs.map((d) => d.id));
      const localTxs = await userDb.transactions.toArray();
      for (const tx of localTxs) {
        if (!remoteTxIds.has(tx.id)) {
          await pushToCloud("transactions", tx.id, "create", tx as unknown as Record<string, unknown>, userId);
        }
      }

      const remoteVaultIds = new Set(vaultsSnap.docs.map((d) => d.id));
      const localVaults = await userDb.vaults.toArray();
      for (const v of localVaults) {
        if (!remoteVaultIds.has(v.id)) {
          await pushToCloud("vaults", v.id, "create", v as unknown as Record<string, unknown>, userId);
        }
      }

      const remoteDebtIds = new Set(debtsSnap.docs.map((d) => d.id));
      const localDebts = await userDb.debts.toArray();
      for (const d of localDebts) {
        if (!remoteDebtIds.has(d.id)) {
          await pushToCloud("debts", d.id, "create", d as unknown as Record<string, unknown>, userId);
        }
      }

      return true;
    } else {
      // Cloud is completely empty for this user: initialize baseline and push to Firestore
      await initializeDatabaseIfEmpty(userId, false);
      await syncAllLocalDataToFirestore(userId);
      return true;
    }
  } catch (err) {
    console.warn("[SyncEngine] Firestore hydration warning:", err);
    return false;
  }
}

/**
 * Initializes two-way real-time Firestore sync and returns an unsubscribe cleanup function.
 */
export function initFirestoreSync(userId: string): () => void {
  if (typeof window === "undefined" || !isSyncEligible(userId) || !firestore) {
    return () => {};
  }

  let isCleanedUp = false;
  const unsubs: (() => void)[] = [];
  const userDb = getDatabaseForUser(userId);

  // 1. Initial hydration pull
  hydrateFromFirestore(userId)
    .then(() => {
      if (isCleanedUp) return;
      drainSyncQueue(userId).catch(console.error);
    })
    .catch((err) => {
      console.warn("[SyncEngine] Hydration error in initFirestoreSync:", err);
    });

  // 2. Real-time onSnapshot listeners on user collections
  const subcollections: Array<{
    name: "accounts" | "transactions" | "vaults" | "debts" | "categories" | "settings";
    table: any;
  }> = [
    { name: "accounts", table: userDb.accounts },
    { name: "transactions", table: userDb.transactions },
    { name: "vaults", table: userDb.vaults },
    { name: "debts", table: userDb.debts },
    { name: "categories", table: userDb.categories },
    { name: "settings", table: userDb.settings },
  ];

  for (const { name, table } of subcollections) {
    const colRef = collection(firestore, `users/${userId}/${name}`);
    const unsub = onSnapshot(
      colRef,
      { includeMetadataChanges: false },
      (snapshot) => {
        if (isCleanedUp) return;
        snapshot.docChanges().forEach(async (change) => {
          // If the change has pending local writes, this client initiated it; ignore to avoid echo
          if (change.doc.metadata.hasPendingWrites) return;

          const docData = { id: change.doc.id, ...change.doc.data() };
          try {
            if (change.type === "added" || change.type === "modified") {
              await table.put(docData);
            } else if (change.type === "removed") {
              await table.delete(change.doc.id);
            }
          } catch (err) {
            console.warn(`[SyncEngine] onSnapshot error applying ${name}/${change.doc.id}:`, err);
          }
        });
      },
      (err) => {
        console.warn(`[SyncEngine] Listener error on ${name}:`, err);
      }
    );
    unsubs.push(unsub);
  }

  // 3. Auto-drain syncQueue when browser regains connectivity
  const handleOnline = () => {
    drainSyncQueue(userId).catch(console.error);
  };
  window.addEventListener("online", handleOnline);

  // 4. Return clean unsubscribe function
  return () => {
    isCleanedUp = true;
    for (const unsub of unsubs) {
      try {
        unsub();
      } catch (err) {
        console.warn("[SyncEngine] Cleanup error:", err);
      }
    }
    window.removeEventListener("online", handleOnline);
  };
}

/**
 * Check and execute due recurring rules
 */
export async function processDueRecurringRules(): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const dueRules = await db.recurring
    .where("nextRunDate")
    .belowOrEqual(today)
    .toArray();

  let executedCount = 0;

  for (const rule of dueRules) {
    if (!rule.autoExecute) continue;

    // Log the transaction
    await addTransactionWithLedgerSync({
      desc: rule.title,
      amount: rule.amount,
      type: rule.type,
      categoryId: rule.categoryId,
      fromAccountId: rule.accountId,
      tags: ["AutoRecurring", "Subscription"],
      date: today,
      time: "06:00",
      isRecurringInstance: true,
      recurringRuleId: rule.id,
      source: "companion_api",
    });

    // Compute next run date based on frequency and interval
    const nextDate = new Date(rule.nextRunDate);
    if (rule.frequency === "daily") {
      nextDate.setDate(nextDate.getDate() + (rule.interval || 1));
    } else if (rule.frequency === "weekly") {
      nextDate.setDate(nextDate.getDate() + 7 * (rule.interval || 1));
    } else if (rule.frequency === "biweekly") {
      nextDate.setDate(nextDate.getDate() + 14 * (rule.interval || 1));
    } else if (rule.frequency === "monthly") {
      nextDate.setMonth(nextDate.getMonth() + (rule.interval || 1));
    } else if (rule.frequency === "yearly") {
      nextDate.setFullYear(nextDate.getFullYear() + (rule.interval || 1));
    }

    const nextRunDateStr = nextDate.toISOString().split("T")[0];
    await db.recurring.update(rule.id, {
      nextRunDate: nextRunDateStr,
      lastExecuted: today,
    });

    executedCount++;
  }

  return executedCount;
}
