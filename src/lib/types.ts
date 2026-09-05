import { z } from "zod";

export type TransactionType =
  | "expense"
  | "income"
  | "transfer"
  | "vault_deposit"
  | "vault_withdraw"
  | "debt_payment"
  | "adjustment";

export type AccountType =
  | "checking"
  | "savings"
  | "credit"
  | "ewallet"
  | "investment"
  | "cash";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string; // ISO: 'IDR', 'USD', etc.
  initialBalance: number;
  currentBalance: number;
  color: string;
  icon: string;
  isArchived: boolean;
  order?: number;
  creditLimit?: number; // Required if type === 'credit'
  statementClosingDay?: number;
}

export interface Transaction {
  id: string;
  desc: string;
  amount: number; // Always positive
  type: TransactionType;
  categoryId: string;
  subcategoryId?: string;
  fromAccountId: string; // Source account ID
  toAccountId?: string; // Target account ID (transfers/vault)
  vaultId?: string; // Vault target
  debtId?: string; // Debt target
  tags: string[]; // e.g., ["ProjectX", "TaxDeductible"]
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:mm"
  note?: string;
  receiptUrl?: string;
  location?: { lat: number; lng: number; name?: string };
  isRecurringInstance?: boolean;
  recurringRuleId?: string;
  source: "web_client" | "companion_api" | "csv_import" | "pwa_quick_action";
  createdAt: string; // ISO timestamp
  updatedAt: string;
}

export interface DebtRepayment {
  transactionId: string;
  amount: number;
  date: string;
  accountId: string;
}

export interface Debt {
  id: string;
  counterparty: string;
  amount: number;
  paidAmount: number;
  direction: "owe" | "owed"; // 'owe' (Payable) | 'owed' (Receivable)
  dueDate?: string; // "YYYY-MM-DD"
  desc: string;
  status: "active" | "settled" | "defaulted";
  repaymentHistory: DebtRepayment[];
  createdAt: string;
}

export interface RecurringRule {
  id: string;
  title: string;
  amount: number;
  type: "expense" | "income" | "transfer";
  categoryId: string;
  accountId: string;
  frequency: "daily" | "weekly" | "biweekly" | "monthly" | "yearly";
  interval: number; // e.g., every 2 weeks -> interval = 2
  startDate: string;
  endDate?: string;
  nextRunDate: string;
  autoExecute: boolean; // Auto-log or notify user to approve
  lastExecuted?: string;
}

export interface Vault {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  assignedAccountId: string; // Liquid backing account
  color: string;
  icon: string;
  status: "active" | "reached" | "liquidated";
  order?: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: "expense" | "income";
  subcategories?: string[];
  budgetCap?: number;
  order: number;
  isDefault?: boolean;
}

export interface UserSecuritySettings {
  pinHash: string; // Salted SHA-256 hash of the master PIN
  pinSalt: string;
  isPinSet: boolean;
  autoLockTimeoutMinutes: number; // 0 = immediate on blur/tab switch, -1 = disabled, 1, 5, 15
  biometricsEnabled: boolean;
  lastUnlockedAt?: number;
}

export type ThemeMode = "light" | "dark" | "midnight-oled" | "system";

export interface UserSettings {
  currency: string; // Default "IDR"
  locale: string; // Default "id-ID"
  monthlyBudget: number;
  categoryBudgets: Record<string, number>;
  theme: ThemeMode | "tokyo-slate" | "pitch-oled" | "clean-paper";
  privacyMode: boolean;
  hapticFeedback: boolean;
  soundEnabled: boolean;
  companionApiKey?: string;
  security: UserSecuritySettings;
}

export interface SyncQueueItem {
  id: string;
  action: "create" | "update" | "delete";
  collection: "accounts" | "transactions" | "debts" | "recurring" | "vaults" | "settings" | "categories";
  payload: Record<string, unknown>;
  timestamp: number;
  status: "pending" | "syncing" | "failed";
  retryCount: number;
  errorMessage?: string;
}

// Zod Validation Schemas
export const TransactionSchema = z.object({
  id: z.string().optional(),
  desc: z.string().min(1, "Description is required"),
  amount: z.number().positive("Amount must be positive"),
  type: z.enum([
    "expense",
    "income",
    "transfer",
    "vault_deposit",
    "vault_withdraw",
    "debt_payment",
    "adjustment",
  ]),
  categoryId: z.string().min(1, "Category is required"),
  subcategoryId: z.string().optional(),
  fromAccountId: z.string().min(1, "Source account is required"),
  toAccountId: z.string().optional(),
  vaultId: z.string().optional(),
  debtId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:mm"),
  note: z.string().optional(),
  receiptUrl: z.string().optional(),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
      name: z.string().optional(),
    })
    .optional(),
  isRecurringInstance: z.boolean().optional(),
  recurringRuleId: z.string().optional(),
  source: z
    .enum(["web_client", "companion_api", "csv_import", "pwa_quick_action"])
    .default("web_client"),
});

export const AccountSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Account name is required"),
  type: z.enum([
    "checking",
    "savings",
    "credit",
    "ewallet",
    "investment",
    "cash",
  ]),
  currency: z.string().min(1).default("IDR"),
  initialBalance: z.number().default(0),
  currentBalance: z.number().default(0),
  color: z.string().default("#00F0FF"),
  icon: z.string().default("wallet"),
  isArchived: z.boolean().default(false),
  creditLimit: z.number().optional(),
  statementClosingDay: z.number().min(1).max(31).optional(),
});

export const CompanionTransactionInputSchema = z.object({
  desc: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(["expense", "income", "transfer", "vault_deposit", "debt_payment"]).default("expense"),
  fromAccountId: z.string().min(1),
  toAccountId: z.string().optional(),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  note: z.string().optional(),
});
