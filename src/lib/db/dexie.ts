import Dexie, { type Table } from "dexie";
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

export class FinanceOSDatabase extends Dexie {
  accounts!: Table<Account, string>;
  transactions!: Table<Transaction, string>;
  debts!: Table<Debt, string>;
  recurring!: Table<RecurringRule, string>;
  vaults!: Table<Vault, string>;
  categories!: Table<Category, string>;
  settings!: Table<UserSettings & { id: string }, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  readonly userId: string;

  constructor(userId: string = "default") {
    const cleanId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
    super(`FinanceOS_v2_${cleanId}`);
    this.userId = userId;

    this.version(1).stores({
      accounts: "id, name, type, isArchived",
      transactions: "id, date, type, fromAccountId, toAccountId, categoryId, vaultId, debtId, createdAt",
      debts: "id, counterparty, direction, status, dueDate",
      recurring: "id, nextRunDate, frequency, accountId",
      vaults: "id, status, assignedAccountId",
      categories: "id, type, name",
      settings: "id",
      syncQueue: "id, status, timestamp, collection",
    });
  }
}

// Active database instance management
const dbInstances = new Map<string, FinanceOSDatabase>();
let currentActiveUserId: string = "default";

/**
 * Gets or creates an isolated IndexedDB database instance for the specified user
 */
export function getDatabaseForUser(userId: string = "default"): FinanceOSDatabase {
  const key = userId || "default";
  let instance = dbInstances.get(key);
  if (!instance) {
    instance = new FinanceOSDatabase(key);
    dbInstances.set(key, instance);
  }
  return instance;
}

/**
 * Sets the active user database for the application session
 */
export function setActiveUserDatabase(userId: string): FinanceOSDatabase {
  currentActiveUserId = userId || "default";
  return getDatabaseForUser(currentActiveUserId);
}

/**
 * Closes and evicts a user's database connection (e.g. on logout)
 */
export async function closeUserDatabase(userId?: string): Promise<void> {
  const targetId = userId || currentActiveUserId;
  const instance = dbInstances.get(targetId);
  if (instance) {
    await instance.close();
    dbInstances.delete(targetId);
  }
  if (targetId === currentActiveUserId) {
    currentActiveUserId = "default";
  }
}

export function getCurrentActiveUserId(): string {
  return currentActiveUserId;
}

/**
 * Dynamic proxy export: delegates property and table access to currently active user database.
 * Preserves 100% backward compatibility with existing code (`db.accounts`, `db.transactions`, etc.)
 * while completely isolating physical storage per user.
 */
export const db: FinanceOSDatabase = new Proxy({} as FinanceOSDatabase, {
  get(_target, prop) {
    const activeDb = getDatabaseForUser(currentActiveUserId);
    const value = (activeDb as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(activeDb);
    }
    return value;
  },
});
