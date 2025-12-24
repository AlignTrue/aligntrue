import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface HoldState {
  externalHold: boolean;
  heldActionsCount: number;
  enabledAt?: string;
}

// In-memory hold state (would be persisted in production)
// Default: external hold is ON for safety
let externalHold = process.env["OPS_EXTERNAL_HOLD_DEFAULT"] !== "0";
let enabledAt: string | undefined = externalHold
  ? new Date().toISOString()
  : undefined;
const heldActions: { id: string; timestamp: string; action: unknown }[] = [];

export async function GET() {
  const state: HoldState = {
    externalHold,
    heldActionsCount: heldActions.length,
    enabledAt,
  };
  return NextResponse.json(state);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "enable") {
      externalHold = true;
      enabledAt = new Date().toISOString();
    } else if (action === "disable") {
      externalHold = false;
      enabledAt = undefined;
    } else if (action === "toggle") {
      externalHold = !externalHold;
      enabledAt = externalHold ? new Date().toISOString() : undefined;
    }

    const state: HoldState = {
      externalHold,
      heldActionsCount: heldActions.length,
      enabledAt,
    };

    return NextResponse.json(state);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update hold" },
      { status: 400 },
    );
  }
}
