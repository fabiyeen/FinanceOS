"use client";

import React, { useMemo, useState } from "react";
import {
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Shield,
  Handshake,
  Trash2,
  Calendar,
  X,
} from "lucide-react";
import { Transaction, TransactionType } from "../../lib/types";
import { formatCurrency } from "../../lib/mathEngine";
import { useUIStore } from "../../store/useUIStore";
import { deleteTransactionWithLedgerSync } from "../../lib/db/syncEngine";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";

export const TransactionFeed: React.FC = () => {
  const { privacyMode, soundEnabled } = useUIStore();

  const transactions = useLiveQuery(() =>
    db.transactions.orderBy("date").reverse().toArray()
  ) ?? [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.get("main"));

  const currency = settings?.currency || "IDR";
  const locale = settings?.locale || "id-ID";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month">("month");

  // Filtered transactions
  const filteredTxs = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    return transactions.filter((tx) => {
      // 1. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDesc = tx.desc.toLowerCase().includes(q);
        const matchesTags = tx.tags.some((t) => t.toLowerCase().includes(q));
        const matchesNote = tx.note?.toLowerCase().includes(q);
        if (!matchesDesc && !matchesTags && !matchesNote) return false;
      }

      // 2. Type filter
      if (selectedType !== "all" && tx.type !== selectedType) {
        return false;
      }

      // 3. Account filter
      if (
        selectedAccount !== "all" &&
        tx.fromAccountId !== selectedAccount &&
        tx.toAccountId !== selectedAccount
      ) {
        return false;
      }

      // 4. Date Range filter
      if (dateRange === "today") {
        return tx.date === todayStr;
      }
      if (dateRange === "month") {
        const [y, m] = tx.date.split("-").map(Number);
        return y === currentYear && m === currentMonth + 1;
      }
      if (dateRange === "week") {
        const txDate = new Date(tx.date);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - txDate.getTime()) / (1000 * 3600 * 24));
        return diffDays >= 0 && diffDays <= 7;
      }

      return true;
    });
  }, [transactions, searchQuery, selectedType, selectedAccount, dateRange]);

  const accountMap = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a]));
  }, [accounts]);

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  const handleDelete = async (txId: string) => {
    if (confirm("Are you sure you want to delete this transaction and reverse its balance impact?")) {
      playSound("delete", soundEnabled);
      triggerHaptic(20);
      await deleteTransactionWithLedgerSync(txId);
    }
  };

  const getTypeIcon = (type: TransactionType) => {
    switch (type) {
      case "income":
        return <ArrowDownLeft className="h-4 w-4 text-[#00FF88]" />;
      case "expense":
        return <ArrowUpRight className="h-4 w-4 text-[#FF5C00]" />;
      case "transfer":
        return <ArrowRightLeft className="h-4 w-4 text-[#00F0FF]" />;
      case "vault_deposit":
      case "vault_withdraw":
        return <Shield className="h-4 w-4 text-[#9D00FF]" />;
      case "debt_payment":
        return <Handshake className="h-4 w-4 text-[#FFB800]" />;
      default:
        return <ArrowUpRight className="h-4 w-4 text-[#94A3B8]" />;
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-sm">
      {/* Top Filter Bar */}
      <div className="p-3 sm:p-4 border-b border-[var(--border-default)] space-y-3 bg-[var(--bg-canvas)]/40">
        <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Recent Transactions
            </h3>
            <span className="rounded-md bg-[var(--bg-surface)] border border-[var(--border-default)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
              {filteredTxs.length} records
            </span>
          </div>

          {/* Quick Date Range Filters */}
          <div className="flex items-center gap-1 bg-[var(--bg-surface)] p-1 rounded-xl border border-[var(--border-default)]">
            <Calendar className="h-3.5 w-3.5 text-[var(--text-muted)] ml-1 mr-0.5" />
            {(["today", "week", "month", "all"] as const).map((range) => (
              <button
                key={range}
                onClick={() => {
                  playSound("tab", soundEnabled);
                  setDateRange(range);
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  dateRange === range
                    ? "bg-[var(--bg-canvas)] text-[var(--text-primary)] border border-[var(--border-default)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search description, tag, note..."
              className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] pl-8 pr-7 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0 ml-1" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-secondary)] focus:border-[var(--accent-primary)] focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
              <option value="vault_deposit">Savings Deposit</option>
              <option value="vault_withdraw">Savings Withdraw</option>
              <option value="debt_payment">Debt Payment</option>
            </select>
          </div>

          {/* Account Filter */}
          <div>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-secondary)] focus:border-[var(--accent-primary)] focus:outline-none"
            >
              <option value="all">All Accounts</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="divide-y divide-[var(--border-default)] max-h-[560px] overflow-y-auto">
        {filteredTxs.length === 0 ? (
          <div className="p-8 text-center">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-canvas)] border border-[var(--border-default)] mb-2 text-[var(--text-muted)]">
              <Search className="h-5 w-5" />
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              No matching transactions found
            </p>
          </div>
        ) : (
          filteredTxs.map((tx) => {
            const fromAcc = accountMap.get(tx.fromAccountId);
            const toAcc = tx.toAccountId ? accountMap.get(tx.toAccountId) : null;
            const category = categoryMap.get(tx.categoryId);

            const isPositive = tx.type === "income";
            const isNegative = tx.type === "expense" || tx.type === "vault_deposit";

            return (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 sm:p-4 hover:bg-[var(--bg-hover)] transition-colors group"
              >
                {/* Left info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-canvas)]">
                    {getTypeIcon(tx.type)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-medium text-[var(--text-primary)] truncate max-w-[200px] sm:max-w-xs">
                        {tx.desc}
                      </span>
                      {category && (
                        <span className="rounded-md bg-[var(--bg-canvas)] border border-[var(--border-default)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] font-medium">
                          {category.name}
                        </span>
                      )}
                      {tx.tags.map((tag) => (
                        <span
                          key={tag}
                          className="hidden sm:inline-block rounded-md bg-[var(--accent-primary)]/10 text-[10px] text-[var(--accent-primary)] px-1.5 py-0.2"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--text-muted)]">
                      <span>{tx.date}</span>
                      <span>{tx.time}</span>
                      <span>•</span>
                      <span className="text-[var(--text-secondary)]">
                        {fromAcc?.name || tx.fromAccountId}
                        {toAcc && ` → ${toAcc.name}`}
                      </span>
                      {tx.isRecurringInstance && (
                        <span className="text-[var(--color-amber)] font-medium">[Recurring]</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Amount & Actions */}
                <div className="flex items-center gap-2 sm:gap-4 shrink-0 pl-2">
                  <div className="text-right">
                    <div
                      className={`text-xs sm:text-sm font-semibold tracking-tight transition-all ${
                        privacyMode ? "privacy-blur" : ""
                      } ${
                        isPositive
                          ? "text-[var(--color-emerald)]"
                          : isNegative
                          ? "text-[var(--color-rose)]"
                          : "text-[var(--accent-primary)]"
                      }`}
                    >
                      {isPositive ? "+" : isNegative ? "-" : ""}
                      {formatCurrency(tx.amount, currency, locale)}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] capitalize">
                      {tx.type.replace("_", " ")}
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDelete(tx.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--color-rose)] hover:bg-[var(--color-rose)]/10 transition-all"
                    title="Delete transaction"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
