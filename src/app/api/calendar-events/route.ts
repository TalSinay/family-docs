import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import CalendarEvent from "@/lib/models/CalendarEvent";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  await connectToDatabase();
  const filter: Record<string, unknown> = { workspaceId };
  // אירוע נכלל אם הוא חופף לטווח: מתחיל בטווח, או שמתחיל לפניו/בתוכו ונגמר בטווח או אחריו
  if (from && to) {
    filter.$or = [{ date: { $gte: from, $lte: to } }, { date: { $lte: to }, endDate: { $gte: from } }];
  }

  const events = await CalendarEvent.find(filter).sort({ date: 1 }).lean();
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const { session, workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { title, date, endDate, notes, color } = await req.json();
  if (!title || !date) {
    return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });
  }
  if (!DATE_RE.test(date) || (endDate && (!DATE_RE.test(endDate) || endDate < date))) {
    return NextResponse.json({ error: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה" }, { status: 400 });
  }

  await connectToDatabase();
  const event = await CalendarEvent.create({
    workspaceId,
    title,
    date,
    endDate: endDate && endDate > date ? endDate : undefined,
    notes,
    color: color || undefined,
    createdBy: session!.user.id,
  });

  return NextResponse.json(event, { status: 201 });
}
