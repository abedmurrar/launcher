import { NextRequest, NextResponse } from "next/server";
import { getGroupRunStatusById } from "@/lib/db/queries/group-runs";
import { getRunsByGroupRunId } from "@/lib/db/queries/runs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const groupRunId = Number((await params).id);
  if (Number.isNaN(groupRunId)) {
    return NextResponse.json({ error: "Invalid group run id" }, { status: 400 });
  }
  const status = await getGroupRunStatusById(groupRunId);
  if (status == null) {
    return NextResponse.json({ error: "Group run not found" }, { status: 404 });
  }
  const runs = await getRunsByGroupRunId(groupRunId);
  return NextResponse.json({ groupRunId, runs });
}
