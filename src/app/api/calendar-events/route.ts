import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import CalendarEvent from "@/lib/models/CalendarEvent";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  await connectToDatabase();
  const filter: Record<string, unknown> = {};
  if (from && to) filter.date = { $gte: from, $lte: to };

  const events = await CalendarEvent.find(filter).sort({ date: 1 }).lean();
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { title, date, notes } = await req.json();
  if (!title || !date) {
    return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });
  }

  await connectToDatabase();
  const event = await CalendarEvent.create({
    title,
    date,
    notes,
    createdBy: (session.user as { id: string }).id,
  });

  return NextResponse.json(event, { status: 201 });
}
