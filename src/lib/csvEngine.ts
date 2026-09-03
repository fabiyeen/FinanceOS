import Papa from "papaparse";
import { Account, Category, Transaction, TransactionType } from "./types";

export interface CsvMapping {
  date: string;
  time?: string;
  desc: string;
  amount: string;
  type?: string;
  category?: string;
  account?: string;
  toAccount?: string;
  note?: string;
  tags?: string;
}

export interface ParsedCsvRow {
  rowIndex: number;
  raw: Record<string, string>;
  mapped: {
    date?: string;
    time?: string;
    desc?: string;
    amount?: number;
    type?: TransactionType;
    categoryId?: string;
    fromAccountId?: string;
    toAccountId?: string;
    note?: string;
    tags?: string[];
  };
  isValid: boolean;
  errors: string[];
  isDuplicate: boolean;
  hash: string;
}

/**
 * Generate deduplication hash based on (date, amount, desc, fromAccountId)
 */
export function generateTxHash(
  date: string,
  amount: number,
  desc: string,
  fromAccountId: string
): string {
  const normDesc = desc.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${date}_${Math.round(amount)}_${normDesc}_${fromAccountId}`;
}

/**
 * Parses raw CSV string with auto delimiter detection
 */
export function parseCsvRaw(csvText: string): {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: string;
} {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });

  const delimiter = parsed.meta.delimiter || ",";
  const headers = parsed.meta.fields || [];
  const rows = (parsed.data || []).filter((r) => Object.keys(r).length > 0);

  return { headers, rows, delimiter };
}

/**
 * Auto-detect mapping based on header names
 */
export function guessCsvMapping(headers: string[]): CsvMapping {
  const mapping: CsvMapping = {
    date: "",
    desc: "",
    amount: "",
  };

  for (const h of headers) {
    const lower = h.trim().toLowerCase();
    if (!mapping.date && (lower.includes("date") || lower.includes("tanggal") || lower.includes("waktu"))) {
      mapping.date = h;
    } else if (!mapping.time && (lower === "time" || lower === "jam")) {
      mapping.time = h;
    } else if (!mapping.desc && (lower.includes("desc") || lower.includes("keterangan") || lower.includes("title") || lower.includes("merchant") || lower.includes("name"))) {
      mapping.desc = h;
    } else if (!mapping.amount && (lower.includes("amount") || lower.includes("nominal") || lower.includes("total") || lower.includes("value") || lower.includes("harga"))) {
      mapping.amount = h;
    } else if (!mapping.type && (lower.includes("type") || lower.includes("tipe") || lower.includes("jenis"))) {
      mapping.type = h;
    } else if (!mapping.category && (lower.includes("category") || lower.includes("kategori"))) {
      mapping.category = h;
    } else if (!mapping.account && (lower.includes("account") || lower.includes("rekening") || lower.includes("bank") || lower.includes("wallet"))) {
      mapping.account = h;
    } else if (!mapping.note && (lower.includes("note") || lower.includes("catatan") || lower.includes("memo"))) {
      mapping.note = h;
    } else if (!mapping.tags && (lower.includes("tag") || lower.includes("labels"))) {
      mapping.tags = h;
    }
  }

  // Fallbacks if not detected
  if (!mapping.date && headers.length > 0) mapping.date = headers[0];
  if (!mapping.desc && headers.length > 1) mapping.desc = headers[1];
  if (!mapping.amount && headers.length > 2) mapping.amount = headers[2];

  return mapping;
}

/**
 * Maps and validates rows against FinanceOS ledger schema and flags duplicates
 */
export function processCsvRows(
  rows: Record<string, string>[],
  mapping: CsvMapping,
  existingTransactions: Transaction[],
  accounts: Account[],
  categories: Category[],
  defaultAccountId: string
): ParsedCsvRow[] {
  // Build set of existing transaction hashes
  const existingHashSet = new Set(
    existingTransactions.map((tx) =>
      generateTxHash(tx.date, tx.amount, tx.desc, tx.fromAccountId)
    )
  );

  return rows.map((row, idx) => {
    const errors: string[] = [];

    // Date
    let dateStr = row[mapping.date]?.trim() || "";
    if (!dateStr) {
      errors.push("Missing date");
    } else {
      // Normalize common date formats: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        // Already YYYY-MM-DD
      } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
        const parts = dateStr.split("/");
        // Assume DD/MM/YYYY
        dateStr = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      } else {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          dateStr = d.toISOString().split("T")[0];
        } else {
          errors.push(`Invalid date format: ${dateStr}`);
        }
      }
    }

    // Time
    const timeStr = mapping.time && row[mapping.time] ? row[mapping.time].trim() : "12:00";

    // Description
    const descStr = row[mapping.desc]?.trim() || "";
    if (!descStr) {
      errors.push("Missing description");
    }

    // Amount
    const rawAmt = row[mapping.amount]?.replace(/[^0-9.-]+/g, "") || "";
    const parsedAmt = Math.abs(parseFloat(rawAmt));
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      errors.push(`Invalid amount: ${row[mapping.amount]}`);
    }

    // Type
    let type: TransactionType = "expense";
    if (mapping.type && row[mapping.type]) {
      const t = row[mapping.type].toLowerCase();
      if (t.includes("in") || t.includes("income") || t.includes("masuk") || t.includes("cr")) {
        type = "income";
      } else if (t.includes("trans") || t.includes("pindah")) {
        type = "transfer";
      }
    }

    // Account Matching
    let fromAccId = defaultAccountId;
    if (mapping.account && row[mapping.account]) {
      const accName = row[mapping.account].toLowerCase().trim();
      const match = accounts.find((a) => a.name.toLowerCase().includes(accName));
      if (match) {
        fromAccId = match.id;
      }
    }

    // Category Matching
    let catId = categories[0]?.id || "cat_general";
    if (mapping.category && row[mapping.category]) {
      const catName = row[mapping.category].toLowerCase().trim();
      const match = categories.find((c) => c.name.toLowerCase().includes(catName));
      if (match) {
        catId = match.id;
      }
    }

    const note = mapping.note ? row[mapping.note]?.trim() : undefined;
    const tags = mapping.tags && row[mapping.tags]
      ? row[mapping.tags].split(/[,;]/).map((t) => t.trim()).filter(Boolean)
      : [];

    const hash = generateTxHash(dateStr, parsedAmt || 0, descStr, fromAccId);
    const isDuplicate = existingHashSet.has(hash);

    return {
      rowIndex: idx,
      raw: row,
      mapped: {
        date: dateStr,
        time: timeStr,
        desc: descStr,
        amount: parsedAmt || 0,
        type,
        categoryId: catId,
        fromAccountId: fromAccId,
        note,
        tags,
      },
      isValid: errors.length === 0,
      errors,
      isDuplicate,
      hash,
    };
  });
}

/**
 * Generate normalized CSV string for export
 */
export function exportToCsv(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
  currency: string = "IDR"
): string {
  const accMap = new Map(accounts.map((a) => [a.id, a.name]));
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const rows = transactions.map((t) => ({
    ID: t.id,
    Date: t.date,
    Time: t.time,
    Type: t.type,
    Amount: t.amount,
    Currency: currency,
    Account: accMap.get(t.fromAccountId) || t.fromAccountId,
    ToAccount: t.toAccountId ? accMap.get(t.toAccountId) || t.toAccountId : "",
    Category: catMap.get(t.categoryId) || t.categoryId,
    Tags: t.tags.join(";"),
    Note: t.note || "",
    Source: t.source,
  }));

  return Papa.unparse(rows);
}

/**
 * Triggers browser download for CSV
 */
export function downloadCsvFile(content: string, filename = "financeos_export.csv") {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
