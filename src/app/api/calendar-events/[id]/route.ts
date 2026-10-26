import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import CalendarEvent from "@/lib/models/CalendarEvent";

// רשימה סגורה של שדות שמותר לעדכן - קודם לכן הועבר כל ה-body ישירות ל-$set,
// מה שהיה מאפשר (תיאורטית) לשלוח workspaceId בבקשה ול"להעביר" את האירוע
// ל-workspace אחר (הסינון {_id, workspaceId} מגן רק על מציאת הרשומה, לא על
// השדות שמעדכנים בה).
const ALLOWED_FIELDS = ["title", "date", "notes", "color"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const update: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) update[key] = body[key];
  }

  await connectToDatabase();

  // יום סיום: ריק/שווה להתחלה = אירוע ליום אחד (מוסרים את השדה)
  const unset: Record<string, 1> = {};
  if ("endDate" in body || "date" in body) {
    let start = typeof body.date === "string" ? body.date : undefined;
    if (!start) {
      const current = await CalendarEvent.findOne({ _id: id, workspaceId }).select("date").lean<{ date: string }>();
      start = current?.date;
    }
    const end = typeof body.endDate === "string" ? body.endDate : undefined;
    if (start && !DATE_RE.test(start)) return NextResponse.json({ error: "תאריך לא תקין" }, { status: 400 });
    if (end && (!DATE_RE.test(end) || (start && end < start))) {
      return NextResponse.json({ error: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה" }, { status: 400 });
    }
    if (end && start && end > start) update.endDate = end;
    else if ("endDate" in body) unset.endDate = 1;
  }

  const event = await CalendarEvent.findOneAndUpdate(
    { _id: id, workspaceId },
    Object.keys(unset).length ? { $set: update, $unset: unset } : update,
    { new: true }
  );
  if (!event) return NextResponse.json({ error: "אירוע לא נמצא" }, { status: 404 });

  return NextResponse.json(event);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { id } = await params;
  await connectToDatabase();
  await CalendarEvent.findOneAndDelete({ _id: id, workspaceId });

  return NextResponse.json({ ok: true });
}
