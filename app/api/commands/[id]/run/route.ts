import { NextRequest, NextResponse } from "next/server";
import { runCommand } from "@/lib/actions";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const commandId = Number((await params).id);
  const result = runCommand(commandId);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: (result.code as number) ?? 400 }
    );
  }
  return NextResponse.json(result.data);
}
