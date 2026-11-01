import { NextResponse } from "next/server";
import { dismissRestore, getRestoreOffers, restoreAll } from "@/lib/actions";

/** GET: pending restore offers. POST: restore them all. DELETE: dismiss them. */
export async function GET() {
  return NextResponse.json(await getRestoreOffers());
}

export async function POST() {
  const result = await restoreAll();
  if (!result.success) return NextResponse.json({ error: result.error }, { status: result.code ?? 500 });
  return NextResponse.json(result.data);
}

export async function DELETE() {
  const result = await dismissRestore();
  if (!result.success) return NextResponse.json({ error: result.error }, { status: result.code ?? 500 });
  return NextResponse.json(result.data);
}
