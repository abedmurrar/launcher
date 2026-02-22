import { NextRequest, NextResponse } from "next/server";
import { buildCommandsList } from "@/lib/commands-list";
import { createCommand } from "@/lib/actions";

export async function GET() {
  return NextResponse.json(await buildCommandsList());
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await createCommand(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: (result as { code?: number }).code ?? 400 }
    );
  }
  return NextResponse.json(result.data);
}
