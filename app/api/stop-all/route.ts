import { NextResponse } from "next/server";
import { stopAll } from "@/lib/actions";

export async function POST() {
  const result = await stopAll();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.code ?? 500 });
  }
  return NextResponse.json(result.data);
}
