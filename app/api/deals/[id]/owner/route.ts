import { NextRequest, NextResponse } from "next/server";
import { reassignOwner } from "@/lib/db";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const body = await req.json();
  const { newOwner, actor = "manager", agentOriginated = false } = body;
  if (!newOwner) return NextResponse.json({ error: "newOwner obrigatório" }, { status: 400 });
  const result = reassignOwner((await context.params).id, newOwner, actor, agentOriginated);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json(result);
}
