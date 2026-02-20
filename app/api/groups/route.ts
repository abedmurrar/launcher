import { NextRequest, NextResponse } from "next/server";
import { buildGroupsList } from "@/lib/groups-list";
import { createGroup } from "@/lib/actions";

export async function GET() {
  return NextResponse.json(buildGroupsList());
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = createGroup(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }
  return NextResponse.json(result.data);
}
