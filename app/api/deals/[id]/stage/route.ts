import { NextRequest, NextResponse } from "next/server";
import { updateStage } from "@/lib/db";
import { Stage } from "@/lib/types";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const body = await req.json();
  const { stage, actor = "manager", agentOriginated = false } = body;
  if (!stage) return NextResponse.json({ error: "stage obrigatório" }, { status: 400 });
  const result = updateStage((await context.params).id, stage as Stage, actor, agentOriginated);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json(result);
}
