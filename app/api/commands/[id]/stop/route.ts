import { NextRequest, NextResponse } from "next/server";
import { stopCommand } from "@/lib/actions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const commandId = Number((await params).id);
  const { searchParams } = new URL(request.url);
  const runIdParam = searchParams.get("runId");
  const runId = runIdParam != null ? Number(runIdParam) : undefined;
  const result = stopCommand(commandId, runId);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: (result.code as number) ?? 400 }
    );
  }
  return NextResponse.json(result.data);
}
