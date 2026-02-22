import { NextRequest, NextResponse } from "next/server";
import { stopGroup } from "@/lib/actions";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const groupId = Number((await params).id);
  const result = await stopGroup(groupId);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: (result.code as number) ?? 400 }
    );
  }
  return NextResponse.json(result.data);
}
