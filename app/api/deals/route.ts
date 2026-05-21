import { NextRequest, NextResponse } from "next/server";
import { getDeals, isSeeded, seedFromCSV, getPipelineStats } from "@/lib/db";

export async function GET(req: NextRequest) {
  if (!isSeeded()) seedFromCSV();

  const { searchParams } = new URL(req.url);
  const statsOnly = searchParams.get("stats") === "1";

  if (statsOnly) {
    return NextResponse.json(getPipelineStats());
  }

  let deals = getDeals();

  const stage = searchParams.get("stage");
  if (stage) {
    const stages = stage.split(",");
    deals = deals.filter((d) => stages.includes(d.stage));
  }

  const segment = searchParams.get("segment");
  if (segment) {
    const segs = segment.split(",");
    deals = deals.filter((d) => segs.includes(d.accountSegment));
  }

  const owner = searchParams.get("owner");
  if (owner) {
    const owners = owner.split(",");
    deals = deals.filter((d) => owners.includes(d.ownerName));
  }

  const search = searchParams.get("q");
  if (search) {
    const q = search.toLowerCase();
    deals = deals.filter(
      (d) =>
        d.accountName.toLowerCase().includes(q) ||
        d.dealId.toLowerCase().includes(q) ||
        d.ownerName.toLowerCase().includes(q) ||
        d.industry.toLowerCase().includes(q)
    );
  }

  const riskMin = searchParams.get("riskMin");
  if (riskMin) deals = deals.filter((d) => (d.riskScore ?? 0) >= parseInt(riskMin));

  const overdueOnly = searchParams.get("overdue") === "1";
  if (overdueOnly) {
    const today = new Date();
    deals = deals.filter((d) => new Date(d.expectedCloseDate) < today);
  }

  const riskyOnly = searchParams.get("risky") === "1";
  if (riskyOnly) deals = deals.filter((d) => (d.riskScore ?? 0) >= 35);

  const closedOnly = searchParams.get("closed") === "1";
  if (!closedOnly) {
    deals = deals.filter((d) => d.stage !== "CLOSED_WON" && d.stage !== "CLOSED_LOST");
  }

  const sort = searchParams.get("sort") ?? "riskScore";
  const dir = searchParams.get("dir") ?? "desc";

  deals.sort((a, b) => {
    let av: number | string = 0;
    let bv: number | string = 0;
    if (sort === "amount") { av = a.amount; bv = b.amount; }
    else if (sort === "riskScore") { av = a.riskScore ?? 0; bv = b.riskScore ?? 0; }
    else if (sort === "daysInCurrentStage") { av = a.daysInCurrentStage; bv = b.daysInCurrentStage; }
    else if (sort === "expectedCloseDate") { av = a.expectedCloseDate; bv = b.expectedCloseDate; }
    else if (sort === "lastActivityAt") {
      av = a.lastActivityAt ?? "0";
      bv = b.lastActivityAt ?? "0";
    }
    if (typeof av === "number" && typeof bv === "number") {
      return dir === "desc" ? bv - av : av - bv;
    }
    return dir === "desc"
      ? String(bv).localeCompare(String(av))
      : String(av).localeCompare(String(bv));
  });

  const limit = parseInt(searchParams.get("limit") ?? "200");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  return NextResponse.json({
    total: deals.length,
    deals: deals.slice(offset, offset + limit),
  });
}
