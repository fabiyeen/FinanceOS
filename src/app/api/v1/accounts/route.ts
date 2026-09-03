import { NextRequest, NextResponse } from "next/server";
import { SEED_ACCOUNTS } from "../../../../lib/db/seedData";

const DEMO_API_KEY = "fos_sec_79a83f120e89b41a9c472d001";

function authenticateBearer(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.split(" ")[1];
  return token === DEMO_API_KEY || token === process.env.COMPANION_API_KEY;
}

export async function GET(request: NextRequest) {
  if (!authenticateBearer(request)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing Companion API Bearer token" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    accounts: SEED_ACCOUNTS,
    timestamp: new Date().toISOString(),
  });
}
