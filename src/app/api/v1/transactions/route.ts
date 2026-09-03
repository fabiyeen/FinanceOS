import { NextRequest, NextResponse } from "next/server";
import { CompanionTransactionInputSchema } from "../../../../lib/types";

const DEMO_API_KEY = "fos_sec_79a83f120e89b41a9c472d001";

function authenticateBearer(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.split(" ")[1];
  return token === DEMO_API_KEY || token === process.env.COMPANION_API_KEY;
}

export async function POST(request: NextRequest) {
  if (!authenticateBearer(request)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing Companion API Bearer token" },
      { status: 401 }
    );
  }

  try {
    const json = await request.json();
    const parsed = CompanionTransactionInputSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { desc, amount, type, fromAccountId, toAccountId, categoryId, tags, date, time, note } =
      parsed.data;

    const today = new Date().toISOString().split("T")[0];
    const hours = String(new Date().getHours()).padStart(2, "0");
    const minutes = String(new Date().getMinutes()).padStart(2, "0");

    const createdTx = {
      id: `tx_api_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      desc,
      amount,
      type,
      fromAccountId,
      toAccountId,
      categoryId: categoryId || "cat_general",
      tags: tags || ["CompanionApi"],
      date: date || today,
      time: time || `${hours}:${minutes}`,
      note,
      source: "companion_api",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(
      {
        success: true,
        message: "Transaction logged successfully via Companion API",
        transaction: createdTx,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!authenticateBearer(request)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing Companion API Bearer token" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    status: "ok",
    endpoint: "/api/v1/transactions",
    version: "v2.0",
  });
}
