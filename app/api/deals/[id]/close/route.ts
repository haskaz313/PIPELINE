import { NextRequest, NextResponse } from "next/server";
import { closeDeal } from "@/lib/db";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const body = await req.json();
  const { outcome, lostReason = null, actor = "manager", agentOriginated = false } = body;
  if (!outcome) return NextResponse.json({ error: "outcome obrigatório" }, { status: 400 });
  const result = closeDeal((await context.params).id, outcome, lostReason, actor, agentOriginated);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json(result);
}
