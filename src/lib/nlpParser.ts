import { Account, Category, TransactionType } from "./types";

export interface ParsedTransactionInput {
  amount?: number;
  type: TransactionType;
  desc: string;
  fromAccountId?: string;
  toAccountId?: string;
  categoryId?: string;
  confidence: number;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food: ["coffee", "lunch", "dinner", "breakfast", "cafe", "starbucks", "food", "makan", "kopi", "restaurant", "burger", "pizza", "grabfood", "gofood"],
  transport: ["uber", "grab", "gojek", "taxi", "fuel", "gas", "bensin", "parking", "parkir", "toll", "subway", "train", "mrt"],
  bills: ["internet", "wifi", "electricity", "pln", "water", "pdam", "bill", "tagihan", "phone", "pulsa"],
  shopping: ["clothes", "amazon", "tokopedia", "shopee", "gadget", "gear", "shoes", "uniqlo"],
  groceries: ["market", "supermarket", "grocery", "indomaret", "alfamart", "sayur"],
  entertainment: ["netflix", "spotify", "steam", "game", "cinema", "movie", "bioskop", "concert"],
  salary: ["salary", "gaji", "bonus", "dividend", "interest", "paycheck", "freelance"],
  health: ["doctor", "medicine", "pharmacy", "apotek", "dentist", "gym"],
  housing: ["rent", "sewa", "kos", "maintenance", "apartment"],
};

export function parseNaturalLanguageInput(
  input: string,
  accounts: Account[],
  categories: Category[]
): ParsedTransactionInput {
  const cleanInput = input.trim();
  if (!cleanInput) {
    return { type: "expense", desc: "", confidence: 0 };
  }

  let type: TransactionType = "expense";
  let amount: number | undefined;
  let fromAccountId: string | undefined;
  let toAccountId: string | undefined;
  let categoryId: string | undefined;
  let confidence = 0.2;

  // 1. Detect Type
  const lower = cleanInput.toLowerCase();
  if (lower.startsWith("+") || lower.includes("income") || lower.includes("salary") || lower.includes("gaji") || lower.includes("received")) {
    type = "income";
    confidence += 0.2;
  } else if (lower.startsWith("transfer") || lower.includes(" tf ") || lower.includes("to account")) {
    type = "transfer";
    confidence += 0.3;
  } else if (lower.includes("debt") || lower.includes("hutang") || lower.includes("iou")) {
    type = "debt_payment";
    confidence += 0.2;
  } else if (lower.includes("vault") || lower.includes("savings goal") || lower.includes("celengan")) {
    type = "vault_deposit";
    confidence += 0.2;
  }

  // 2. Detect Amount
  // Matches: 50k, 50.5k, 1.2m, 20jt, 100rb, 50000, Rp 50.000, $50
  const amountRegex = /(?:rp|idr|\$)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(k|rb|ribu|m|jt|juta)?\b/i;
  const amountMatch = cleanInput.match(amountRegex);

  if (amountMatch) {
    const rawVal = parseFloat(amountMatch[1].replace(",", "."));
    const unit = (amountMatch[2] || "").toLowerCase();

    if (unit === "k" || unit === "rb" || unit === "ribu") {
      amount = Math.round(rawVal * 1000);
    } else if (unit === "m" || unit === "jt" || unit === "juta") {
      amount = Math.round(rawVal * 1000000);
    } else {
      amount = Math.round(rawVal);
    }
    confidence += 0.3;
  }

  // 3. Match Accounts
  for (const acc of accounts) {
    const accName = acc.name.toLowerCase();
    if (lower.includes(accName)) {
      if (type === "transfer" && fromAccountId && fromAccountId !== acc.id) {
        toAccountId = acc.id;
      } else {
        fromAccountId = acc.id;
      }
      confidence += 0.2;
    }
  }

  // Fallback to primary liquid account if fromAccountId not matched
  if (!fromAccountId && accounts.length > 0) {
    const defaultAcc = accounts.find((a) => a.type === "checking" || a.type === "cash") || accounts[0];
    fromAccountId = defaultAcc.id;
  }

  // 4. Match Category
  for (const [catKey, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        const found = categories.find((c) =>
          c.name.toLowerCase().includes(catKey) ||
          c.id.toLowerCase().includes(catKey)
        );
        if (found) {
          categoryId = found.id;
          confidence += 0.2;
          break;
        }
      }
    }
    if (categoryId) break;
  }

  if (!categoryId && categories.length > 0) {
    categoryId = categories[0].id;
  }

  // Clean description by removing amount, command prefixes, etc.
  let desc = cleanInput
    .replace(/^(spent|paid|buy|beli|income|salary|transfer)\s+/i, "")
    .replace(/(?:from|to|with|pake|via)\s+[a-zA-Z0-9_-]+/gi, "")
    .replace(amountRegex, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!desc) {
    desc = cleanInput;
  }

  // Capitalize description
  desc = desc.charAt(0).toUpperCase() + desc.slice(1);

  return {
    amount,
    type,
    desc,
    fromAccountId,
    toAccountId,
    categoryId,
    confidence: Math.min(1.0, confidence),
  };
}
