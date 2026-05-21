import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/db";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const body = await req.json();
  const {
    type,
    notes = "",
    actor = "manager",
    agentOriginated = false,
    isPlanned = false,
    scheduledAt,
  } = body;
  if (!type) return NextResponse.json({ error: "type obrigatório" }, { status: 400 });
  const result = logActivity((await context.params).id, type, notes, actor, agentOriginated, isPlanned, scheduledAt);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json(result);
}
