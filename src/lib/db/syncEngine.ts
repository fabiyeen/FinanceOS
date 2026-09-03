import { applyTransaction } from "../mathEngine";
import {
  Account,
  Debt,
  RecurringRule,
  SyncQueueItem,
  Transaction,
  UserSettings,
  Vault,
} from "../types";
import { db } from "./dexie";
import {
  generateSeedTransactions,
  SEED_ACCOUNTS,
  SEED_CATEGORIES,
  SEED_DEBTS,
  SEED_RECURRING,
  SEED_SETTINGS,
  SEED_VAULTS,
} from "./seedData";

import { FACTORY_BASELINE_ACCOUNTS } from "./seedData";
import { getDatabaseForUser } from "./dexie";
import { createDefaultSecuritySettings } from "../security";

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

  return true;
}

/**
 * Adds a transaction with zero-sum ledger integrity and queues offline sync
 */
export async function addTransactionWithLedgerSync(
  txData: Omit<Transaction, "id" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<{ transaction: Transaction; error?: string }> {
  const id = txData.id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const transaction: Transaction = {
    ...txData,
    id,
    createdAt: now,
    updatedAt: now,
  };

  const accounts = await db.accounts.toArray();
  const vaults = await db.vaults.toArray();
  const debts = await db.debts.toArray();

  const result = applyTransaction(transaction, accounts, vaults, debts);

  if (result.error) {
    return { transaction, error: result.error };
  }

  await db.transaction("rw", [
    db.transactions,
    db.accounts,
    db.vaults,
    db.debts,
    db.syncQueue,
  ], async () => {
    await db.transactions.add(transaction);
    await db.accounts.bulkPut(result.accounts);
    await db.vaults.bulkPut(result.vaults);
    await db.debts.bulkPut(result.debts);

    // Add to offline sync queue
    const queueItem: SyncQueueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      action: "create",
      collection: "transactions",
      payload: transaction as unknown as Record<string, unknown>,
      timestamp: Date.now(),
      status: "pending",
      retryCount: 0,
    };
    await db.syncQueue.add(queueItem);
  });

  return { transaction };
}

/**
 * Deletes a transaction and reverses its ledger effects
 */
export async function deleteTransactionWithLedgerSync(txId: string): Promise<boolean> {
  const tx = await db.transactions.get(txId);
  if (!tx) return false;

  // Reverse transaction effect
  let reverseType = tx.type;
  if (tx.type === "expense") reverseType = "income";
  else if (tx.type === "income") reverseType = "expense";
  else if (tx.type === "transfer") {
    // Reverse from and to
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

  const accounts = await db.accounts.toArray();
  const vaults = await db.vaults.toArray();
  const debts = await db.debts.toArray();

  const result = applyTransaction(reverseTx, accounts, vaults, debts);

  await db.transaction("rw", [
    db.transactions,
    db.accounts,
    db.vaults,
    db.debts,
    db.syncQueue,
  ], async () => {
    await db.transactions.delete(txId);
    if (!result.error) {
      await db.accounts.bulkPut(result.accounts);
      await db.vaults.bulkPut(result.vaults);
      await db.debts.bulkPut(result.debts);
    }
    const queueItem: SyncQueueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      action: "delete",
      collection: "transactions",
      payload: { id: txId },
      timestamp: Date.now(),
      status: "pending",
      retryCount: 0,
    };
    await db.syncQueue.add(queueItem);
  });

  return true;
}

/**
 * Process pending items in sync queue when connection is restored
 */
export async function drainSyncQueue(): Promise<{ processed: number; failed: number }> {
  if (typeof window === "undefined" || !navigator.onLine) {
    return { processed: 0, failed: 0 };
  }

  const pendingItems = await db.syncQueue
    .where("status")
    .equals("pending")
    .toArray();

  if (pendingItems.length === 0) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;

  for (const item of pendingItems) {
    try {
      // Simulate network sync latency
      await new Promise((res) => setTimeout(res, 80));
      // Mark item as synced / remove from local queue
      await db.syncQueue.delete(item.id);
      processed++;
    } catch {
      failed++;
      await db.syncQueue.update(item.id, {
        retryCount: item.retryCount + 1,
        status: item.retryCount >= 3 ? "failed" : "pending",
      });
    }
  }

  return { processed, failed };
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
