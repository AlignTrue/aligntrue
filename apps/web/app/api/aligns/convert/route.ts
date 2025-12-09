import { NextResponse } from "next/server";
import { convertContent } from "@/lib/aligns/convert";

export const dynamic = "force-dynamic";

type AgentId = "all" | "cursor" | "claude" | "windsurf" | "copilot";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (
      !body ||
      typeof body.content !== "string" ||
      typeof body.targetAgent !== "string"
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const targetAgent = body.targetAgent as AgentId;
    const { text, filename, extension } = convertContent(
      body.content,
      targetAgent,
    );

    return NextResponse.json({ text, filename, extension });
  } catch (error) {
    console.error("convert API error", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
