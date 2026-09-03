import assert from "node:assert";
import test from "node:test";
import {
  applyTransaction,
  calculateDebtToAssetRatio,
  calculateNetWorth,
  calculateRunway,
  computeMonthlyMetrics,
  safeAdd,
  safeDiv,
  safeMul,
  safeSub,
} from "./mathEngine";
import { Account, Debt, Transaction, Vault } from "./types";

test("Safe floating point operations avoid 0.1 + 0.2 error", () => {
  const result = safeAdd(0.1, 0.2);
  assert.strictEqual(result, 0.3);

  const sub = safeSub(0.3, 0.1);
  assert.strictEqual(sub, 0.2);

  const mul = safeMul(10.5, 2);
  assert.strictEqual(mul, 21);

  const div = safeDiv(100, 4);
  assert.strictEqual(div, 25);
});

test("Atomic transfer between accounts debit source and credit destination", () => {
  const accounts: Account[] = [
    {
      id: "acc_1",
      name: "BCA Checking",
      type: "checking",
      currency: "IDR",
      initialBalance: 1000000,
      currentBalance: 1000000,
      color: "#00F0FF",
      icon: "wallet",
      isArchived: false,
    },
    {
      id: "acc_2",
      name: "Mandiri Savings",
      type: "savings",
      currency: "IDR",
      initialBalance: 500000,
      currentBalance: 500000,
      color: "#00FF88",
      icon: "bank",
      isArchived: false,
    },
  ];

  const tx: Transaction = {
    id: "tx_1",
    desc: "Transfer to Savings",
    amount: 250000,
    type: "transfer",
    categoryId: "transfer",
    fromAccountId: "acc_1",
    toAccountId: "acc_2",
    tags: [],
    date: "2026-09-03",
    time: "10:00",
    source: "web_client",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const res = applyTransaction(tx, accounts, [], []);
  assert.strictEqual(res.error, undefined);
  const acc1 = res.accounts.find((a) => a.id === "acc_1");
  const acc2 = res.accounts.find((a) => a.id === "acc_2");

  assert.strictEqual(acc1?.currentBalance, 750000);
  assert.strictEqual(acc2?.currentBalance, 750000);
});

test("Transfer fails if source and destination are the same", () => {
  const accounts: Account[] = [
    {
      id: "acc_1",
      name: "BCA Checking",
      type: "checking",
      currency: "IDR",
      initialBalance: 1000000,
      currentBalance: 1000000,
      color: "#00F0FF",
      icon: "wallet",
      isArchived: false,
    },
  ];

  const tx: Transaction = {
    id: "tx_2",
    desc: "Self transfer",
    amount: 100000,
    type: "transfer",
    categoryId: "transfer",
    fromAccountId: "acc_1",
    toAccountId: "acc_1",
    tags: [],
    date: "2026-09-03",
    time: "10:00",
    source: "web_client",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const res = applyTransaction(tx, accounts, [], []);
  assert.ok(res.error?.includes("Cannot transfer to the same account"));
});

test("Vault deposit debits account and credits vault, marks reached if threshold met", () => {
  const accounts: Account[] = [
    {
      id: "acc_1",
      name: "BCA Checking",
      type: "checking",
      currency: "IDR",
      initialBalance: 5000000,
      currentBalance: 5000000,
      color: "#00F0FF",
      icon: "wallet",
      isArchived: false,
    },
  ];

  const vaults: Vault[] = [
    {
      id: "vault_1",
      title: "Japan Trip",
      targetAmount: 10000000,
      currentAmount: 9000000,
      assignedAccountId: "acc_1",
      color: "#FF5C00",
      icon: "plane",
      status: "active",
    },
  ];

  const tx: Transaction = {
    id: "tx_3",
    desc: "Top up Japan Trip",
    amount: 1000000,
    type: "vault_deposit",
    categoryId: "savings",
    fromAccountId: "acc_1",
    vaultId: "vault_1",
    tags: [],
    date: "2026-09-03",
    time: "10:00",
    source: "web_client",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const res = applyTransaction(tx, accounts, vaults, []);
  const acc = res.accounts.find((a) => a.id === "acc_1");
  const vault = res.vaults.find((v) => v.id === "vault_1");

  assert.strictEqual(acc?.currentBalance, 4000000);
  assert.strictEqual(vault?.currentAmount, 10000000);
  assert.strictEqual(vault?.status, "reached");
});

test("Debt repayment settles debt when paidAmount reaches amount", () => {
  const accounts: Account[] = [
    {
      id: "acc_1",
      name: "Cash",
      type: "cash",
      currency: "IDR",
      initialBalance: 1000000,
      currentBalance: 1000000,
      color: "#00F0FF",
      icon: "wallet",
      isArchived: false,
    },
  ];

  const debts: Debt[] = [
    {
      id: "debt_1",
      counterparty: "Kenji",
      amount: 500000,
      paidAmount: 200000,
      direction: "owe",
      desc: "Dinner split",
      status: "active",
      repaymentHistory: [],
      createdAt: new Date().toISOString(),
    },
  ];

  const tx: Transaction = {
    id: "tx_pay",
    desc: "Settled remainder to Kenji",
    amount: 300000,
    type: "debt_payment",
    categoryId: "debt",
    fromAccountId: "acc_1",
    debtId: "debt_1",
    tags: [],
    date: "2026-09-03",
    time: "12:00",
    source: "web_client",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const res = applyTransaction(tx, accounts, [], debts);
  const acc = res.accounts.find((a) => a.id === "acc_1");
  const debt = res.debts.find((d) => d.id === "debt_1");

  assert.strictEqual(acc?.currentBalance, 700000);
  assert.strictEqual(debt?.paidAmount, 500000);
  assert.strictEqual(debt?.status, "settled");
  assert.strictEqual(debt?.repaymentHistory.length, 1);
});

test("Net Worth and Debt-to-Asset ratio calculation", () => {
  const accounts: Account[] = [
    {
      id: "acc_1",
      name: "Checking",
      type: "checking",
      currency: "IDR",
      initialBalance: 10000000,
      currentBalance: 10000000,
      color: "#00F0FF",
      icon: "wallet",
      isArchived: false,
    },
    {
      id: "acc_card",
      name: "Tokyo Platinum CC",
      type: "credit",
      currency: "IDR",
      initialBalance: 0,
      currentBalance: -2000000, // 2M owed on CC
      color: "#FF5C00",
      icon: "credit-card",
      isArchived: false,
    },
  ];

  const vaults: Vault[] = [
    {
      id: "vault_1",
      title: "Emergency Fund",
      targetAmount: 5000000,
      currentAmount: 5000000,
      assignedAccountId: "acc_1",
      color: "#00FF88",
      icon: "shield",
      status: "reached",
    },
  ];

  const debts: Debt[] = [
    {
      id: "debt_1",
      counterparty: "Store",
      amount: 1000000,
      paidAmount: 0,
      direction: "owe", // 1M owed
      desc: "Monitor Installment",
      status: "active",
      repaymentHistory: [],
      createdAt: new Date().toISOString(),
    },
  ];

  // Assets = 10M (checking) + 5M (vault) = 15M
  // Liabilities = 2M (credit card) + 1M (debt) = 3M
  // Net worth = 15M - 3M = 12M
  const netWorth = calculateNetWorth(accounts, vaults, debts);
  assert.strictEqual(netWorth, 12000000);

  // Debt-to-asset = (3M / 12M) * 100 = 25%
  const ratio = calculateDebtToAssetRatio(accounts, debts, netWorth);
  assert.strictEqual(ratio, 25);
});
