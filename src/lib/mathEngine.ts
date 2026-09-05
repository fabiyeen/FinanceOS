import { Account, Debt, Transaction, Vault } from "./types";

/**
 * Minor unit scale: 100 for 2 decimal places (cents)
 * Eliminates IEEE 754 floating point arithmetic anomalies.
 */
const SCALE = 100;

export function toMinor(amount: number): number {
  return Math.round(amount * SCALE);
}

export function fromMinor(minor: number): number {
  return minor / SCALE;
}

export function safeAdd(a: number, b: number): number {
  return fromMinor(toMinor(a) + toMinor(b));
}

export function safeSub(a: number, b: number): number {
  return fromMinor(toMinor(a) - toMinor(b));
}

export function safeMul(a: number, b: number): number {
  return fromMinor(Math.round((toMinor(a) * toMinor(b)) / SCALE));
}

export function safeDiv(a: number, b: number): number {
  if (b === 0) return 0;
  return fromMinor(Math.round((toMinor(a) * SCALE) / toMinor(b)));
}

export interface LedgerApplicationResult {
  accounts: Account[];
  vaults: Vault[];
  debts: Debt[];
  error?: string;
}

/**
 * Zero-sum ledger application.
 * Applies a transaction atomically to accounts, vaults, and debts.
 */
export function applyTransaction(
  tx: Transaction,
  currentAccounts: Account[],
  currentVaults: Vault[],
  currentDebts: Debt[]
): LedgerApplicationResult {
  const accountsMap = new Map(currentAccounts.map((a) => [a.id, { ...a }]));
  const vaultsMap = new Map(currentVaults.map((v) => [v.id, { ...v }]));
  const debtsMap = new Map(currentDebts.map((d) => [d.id, { ...d }]));

  const fromAcc = accountsMap.get(tx.fromAccountId);
  if (!fromAcc) {
    return {
      accounts: currentAccounts,
      vaults: currentVaults,
      debts: currentDebts,
      error: `Source account ${tx.fromAccountId} not found`,
    };
  }

  const amount = Math.abs(tx.amount);

  switch (tx.type) {
    case "expense": {
      fromAcc.currentBalance = safeSub(fromAcc.currentBalance, amount);
      break;
    }

    case "income": {
      fromAcc.currentBalance = safeAdd(fromAcc.currentBalance, amount);
      break;
    }

    case "transfer": {
      if (!tx.toAccountId) {
        return {
          accounts: currentAccounts,
          vaults: currentVaults,
          debts: currentDebts,
          error: "Transfer requires a target account (toAccountId)",
        };
      }
      if (tx.fromAccountId === tx.toAccountId) {
        return {
          accounts: currentAccounts,
          vaults: currentVaults,
          debts: currentDebts,
          error: "Cannot transfer to the same account",
        };
      }
      const toAcc = accountsMap.get(tx.toAccountId);
      if (!toAcc) {
        return {
          accounts: currentAccounts,
          vaults: currentVaults,
          debts: currentDebts,
          error: `Target account ${tx.toAccountId} not found`,
        };
      }
      fromAcc.currentBalance = safeSub(fromAcc.currentBalance, amount);
      toAcc.currentBalance = safeAdd(toAcc.currentBalance, amount);
      break;
    }

    case "vault_deposit": {
      if (!tx.vaultId) {
        return {
          accounts: currentAccounts,
          vaults: currentVaults,
          debts: currentDebts,
          error: "Vault deposit requires a target vaultId",
        };
      }
      const vault = vaultsMap.get(tx.vaultId);
      if (!vault) {
        return {
          accounts: currentAccounts,
          vaults: currentVaults,
          debts: currentDebts,
          error: `Vault ${tx.vaultId} not found`,
        };
      }
      fromAcc.currentBalance = safeSub(fromAcc.currentBalance, amount);
      vault.currentAmount = safeAdd(vault.currentAmount, amount);
      if (vault.currentAmount >= vault.targetAmount) {
        vault.status = "reached";
      }
      break;
    }

    case "vault_withdraw": {
      if (!tx.vaultId) {
        return {
          accounts: currentAccounts,
          vaults: currentVaults,
          debts: currentDebts,
          error: "Vault withdraw requires a source vaultId",
        };
      }
      const vault = vaultsMap.get(tx.vaultId);
      if (!vault) {
        return {
          accounts: currentAccounts,
          vaults: currentVaults,
          debts: currentDebts,
          error: `Vault ${tx.vaultId} not found`,
        };
      }
      const destAccountId = tx.toAccountId || tx.fromAccountId;
      const destAcc = accountsMap.get(destAccountId);
      if (!destAcc) {
        return {
          accounts: currentAccounts,
          vaults: currentVaults,
          debts: currentDebts,
          error: `Target account ${destAccountId} not found`,
        };
      }
      vault.currentAmount = safeSub(vault.currentAmount, amount);
      destAcc.currentBalance = safeAdd(destAcc.currentBalance, amount);
      if (vault.currentAmount < vault.targetAmount && vault.status === "reached") {
        vault.status = "active";
      }
      break;
    }

    case "debt_payment": {
      if (!tx.debtId) {
        return {
          accounts: currentAccounts,
          vaults: currentVaults,
          debts: currentDebts,
          error: "Debt payment requires a debtId",
        };
      }
      const debt = debtsMap.get(tx.debtId);
      if (!debt) {
        return {
          accounts: currentAccounts,
          vaults: currentVaults,
          debts: currentDebts,
          error: `Debt record ${tx.debtId} not found`,
        };
      }

      if (debt.direction === "owe") {
        // We owe someone money: Paying it reduces our cash and increases paidAmount
        fromAcc.currentBalance = safeSub(fromAcc.currentBalance, amount);
      } else {
        // Someone owes us money: Receiving payment increases our cash and increases paidAmount
        fromAcc.currentBalance = safeAdd(fromAcc.currentBalance, amount);
      }

      debt.paidAmount = safeAdd(debt.paidAmount, amount);
      debt.repaymentHistory = [
        ...debt.repaymentHistory,
        {
          transactionId: tx.id,
          amount,
          date: tx.date,
          accountId: fromAcc.id,
        },
      ];

      if (debt.paidAmount >= debt.amount) {
        debt.status = "settled";
      }
      break;
    }

    case "adjustment": {
      // Direct balance reset
      fromAcc.currentBalance = amount;
      break;
    }

    default:
      break;
  }

  return {
    accounts: Array.from(accountsMap.values()),
    vaults: Array.from(vaultsMap.values()),
    debts: Array.from(debtsMap.values()),
  };
}

/**
 * Calculates Net Worth across liquid cash, investments, vaults, and liabilities
 */
export function calculateNetWorth(
  accounts: Account[],
  vaults: Vault[],
  debts: Debt[]
): number {
  let totalLiquid = 0;
  let totalLiabilities = 0;

  for (const acc of accounts) {
    if (acc.isArchived) continue;
    if (acc.type === "credit") {
      // In credit cards, negative balance or used limit is a liability
      if (acc.currentBalance < 0) {
        totalLiabilities = safeAdd(totalLiabilities, Math.abs(acc.currentBalance));
      } else {
        totalLiquid = safeAdd(totalLiquid, acc.currentBalance);
      }
    } else {
      totalLiquid = safeAdd(totalLiquid, acc.currentBalance);
    }
  }

  // Vault funds are liquid assets locked in sinking funds
  for (const v of vaults) {
    if (v.status !== "liquidated") {
      totalLiquid = safeAdd(totalLiquid, v.currentAmount);
    }
  }

  // Active debts we owe are liabilities; debts owed to us are receivables
  for (const d of debts) {
    if (d.status === "active") {
      const remaining = safeSub(d.amount, d.paidAmount);
      if (remaining > 0) {
        if (d.direction === "owe") {
          totalLiabilities = safeAdd(totalLiabilities, remaining);
        } else {
          totalLiquid = safeAdd(totalLiquid, remaining);
        }
      }
    }
  }

  return safeSub(totalLiquid, totalLiabilities);
}

/**
 * Computes burn rate, projected monthly spend, savings rate, and velocity metrics
 */
export function computeMonthlyMetrics(
  transactions: Transaction[],
  referenceDate: Date = new Date(),
  monthlyBudget: number = 0
) {
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();
  const currentDay = referenceDate.getDate();

  // Days in current month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Filter transactions for current month
  let spentThisMonth = 0;
  let incomeThisMonth = 0;

  for (const tx of transactions) {
    const [y, m] = tx.date.split("-").map(Number);
    if (y === currentYear && m === currentMonth + 1) {
      if (tx.type === "expense") {
        spentThisMonth = safeAdd(spentThisMonth, tx.amount);
      } else if (tx.type === "income") {
        incomeThisMonth = safeAdd(incomeThisMonth, tx.amount);
      }
    }
  }

  // Daily Burn Rate: Spent this month divided by day-of-month
  const dailyBurnRate = currentDay > 0 ? safeDiv(spentThisMonth, currentDay) : 0;

  // Projected End-of-Month Spend: (spentSoFar / currentDay) * daysInMonth
  const projectedEOMSpend =
    currentDay > 0
      ? safeMul(dailyBurnRate, daysInMonth)
      : spentThisMonth;

  // Savings Rate (%): ((totalIncome - totalExpenses) / totalIncome) * 100
  let savingsRate = 0;
  if (incomeThisMonth > 0) {
    const netSavings = safeSub(incomeThisMonth, spentThisMonth);
    savingsRate = Math.round((netSavings / incomeThisMonth) * 10000) / 100;
  }

  // Spend Velocity Gauge: Compares current spend against the ideal linear burn rate of the monthly budget
  // Ideal linear spend to date = (monthlyBudget / daysInMonth) * currentDay
  let spendVelocityRatio = 1.0;
  let idealSpendToDate = 0;
  if (monthlyBudget > 0 && daysInMonth > 0) {
    idealSpendToDate = (monthlyBudget / daysInMonth) * currentDay;
    if (idealSpendToDate > 0) {
      spendVelocityRatio = Math.round((spentThisMonth / idealSpendToDate) * 100) / 100;
    }
  }

  return {
    spentThisMonth,
    incomeThisMonth,
    dailyBurnRate,
    projectedEOMSpend,
    savingsRate,
    daysInMonth,
    currentDay,
    spendVelocityRatio,
    idealSpendToDate: Math.round(idealSpendToDate),
  };
}

/**
 * Runway Calculator: Total Liquid Reserves / 3-Month Trailing Average Monthly Expense
 */
export function calculateRunway(
  accounts: Account[],
  transactions: Transaction[],
  referenceDate: Date = new Date()
): { runwayMonths: number; liquidReserves: number; trailingAvgExpense: number } {
  // Liquid reserves = checking + savings + cash + ewallet
  const liquidTypes = new Set(["checking", "savings", "cash", "ewallet"]);
  let liquidReserves = 0;
  for (const acc of accounts) {
    if (!acc.isArchived && liquidTypes.has(acc.type) && acc.currentBalance > 0) {
      liquidReserves = safeAdd(liquidReserves, acc.currentBalance);
    }
  }

  // Calculate trailing 3 months expense
  const monthlyExpenses: Record<string, number> = {};
  for (let i = 1; i <= 3; i++) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyExpenses[key] = 0;
  }

  for (const tx of transactions) {
    if (tx.type === "expense") {
      const key = tx.date.substring(0, 7);
      if (Object.prototype.hasOwnProperty.call(monthlyExpenses, key)) {
        monthlyExpenses[key] = safeAdd(monthlyExpenses[key], tx.amount);
      }
    }
  }

  const expenseValues = Object.values(monthlyExpenses);
  const totalTrailing = expenseValues.reduce((sum, v) => safeAdd(sum, v), 0);
  // If no prior 3-month history, fallback to current month expenses or 1
  let trailingAvgExpense = expenseValues.length > 0 ? totalTrailing / 3 : 0;
  if (trailingAvgExpense === 0) {
    // Check all-time monthly average
    const allExpenses = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => safeAdd(sum, t.amount), 0);
    trailingAvgExpense = allExpenses > 0 ? allExpenses : 1;
  }

  const runwayMonths =
    trailingAvgExpense > 0
      ? Math.round((liquidReserves / trailingAvgExpense) * 10) / 10
      : 99.9;

  return {
    runwayMonths,
    liquidReserves,
    trailingAvgExpense: Math.round(trailingAvgExpense),
  };
}

/**
 * Debt-to-Asset Ratio: Total Outstanding Payables / Net Worth
 */
export function calculateDebtToAssetRatio(
  accounts: Account[],
  debts: Debt[],
  netWorth: number
): number {
  let outstandingPayables = 0;

  for (const d of debts) {
    if (d.status === "active" && d.direction === "owe") {
      const remaining = safeSub(d.amount, d.paidAmount);
      if (remaining > 0) {
        outstandingPayables = safeAdd(outstandingPayables, remaining);
      }
    }
  }

  for (const a of accounts) {
    if (a.type === "credit" && a.currentBalance < 0) {
      outstandingPayables = safeAdd(outstandingPayables, Math.abs(a.currentBalance));
    }
  }

  if (netWorth <= 0) return outstandingPayables > 0 ? 100 : 0;
  return Math.round((outstandingPayables / netWorth) * 10000) / 100;
}

/**
 * Formatting helper for Neo-Tokyo financial figures
 */
export function formatCurrency(
  amount: number,
  currency: string = "IDR",
  locale: string = "id-ID",
  hideDecimals: boolean = true
): string {
  try {
    const isIDR = currency === "IDR";
    const fractionDigits = isIDR || hideDecimals ? 0 : 2;

    const formatted = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
    }).format(amount);

    return formatted;
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/**
 * Recalculates account, vault, and debt balances from initial balances and all ledger transactions.
 * Guarantees zero-sum consistency across multi-device synchronizations without destructive zeroing.
 */
export function recalculateLedgerBalances(
  accounts: Account[],
  transactions: Transaction[],
  vaults: Vault[] = [],
  debts: Debt[] = []
): { accounts: Account[]; vaults: Vault[]; debts: Debt[] } {
  if (accounts.length === 0) {
    return { accounts, vaults, debts };
  }

  // If there are no transactions, ensure currentBalance defaults to initialBalance if undefined/NaN
  if (transactions.length === 0) {
    return {
      accounts: accounts.map((a) => ({
        ...a,
        currentBalance:
          typeof a.currentBalance === "number" && !isNaN(a.currentBalance)
            ? a.currentBalance
            : (a.initialBalance ?? 0),
      })),
      vaults,
      debts,
    };
  }

  // Clone objects starting from initial baseline
  let currentAccounts = accounts.map((a) => ({
    ...a,
    currentBalance:
      typeof a.initialBalance === "number" && !isNaN(a.initialBalance) ? a.initialBalance : 0,
  }));
  let currentVaults = vaults.map((v) => ({ ...v, currentAmount: 0 }));
  let currentDebts = debts.map((d) => ({ ...d, paidAmount: 0 }));

  // Sort transactions chronologically: date, then time, then createdAt
  const sortedTxs = [...transactions].sort((a, b) => {
    const aKey = `${a.date || ""}T${a.time || "00:00"}_${a.createdAt || ""}`;
    const bKey = `${b.date || ""}T${b.time || "00:00"}_${b.createdAt || ""}`;
    return aKey.localeCompare(bKey);
  });

  for (const tx of sortedTxs) {
    const res = applyTransaction(tx, currentAccounts, currentVaults, currentDebts);
    if (!res.error) {
      currentAccounts = res.accounts;
      currentVaults = res.vaults;
      currentDebts = res.debts;
    }
  }

  return {
    accounts: currentAccounts,
    vaults: currentVaults,
    debts: currentDebts,
  };
}
