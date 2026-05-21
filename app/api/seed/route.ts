import { NextResponse } from "next/server";
import { seedFromCSV, isSeeded } from "@/lib/db";

export async function POST() {
  try {
    const result = seedFromCSV();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ seeded: isSeeded() });
}
