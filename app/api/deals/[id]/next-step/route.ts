import { NextRequest, NextResponse } from "next/server";
import { scheduleNextStep } from "@/lib/db";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const body = await req.json();
  const { type, notes = "", dueAt, actor = "manager", agentOriginated = false } = body;
  if (!type || !dueAt) {
    return NextResponse.json({ error: "type e dueAt obrigatórios" }, { status: 400 });
  }
  const result = scheduleNextStep((await context.params).id, type, notes, dueAt, actor, agentOriginated);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json(result);
}
