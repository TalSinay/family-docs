import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import CalendarEvent from "@/lib/models/CalendarEvent";

export async function GET(req: NextRequest) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  await connectToDatabase();
  const filter: Record<string, unknown> = { workspaceId };
  if (from && to) filter.date = { $gte: from, $lte: to };

  const events = await CalendarEvent.find(filter).sort({ date: 1 }).lean();
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const { session, workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { title, date, notes } = await req.json();
  if (!title || !date) {
    return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });
  }

  await connectToDatabase();
  const event = await CalendarEvent.create({
    workspaceId,
    title,
    date,
    notes,
    createdBy: session!.user.id,
  });

  return NextResponse.json(event, { status: 201 });
}
