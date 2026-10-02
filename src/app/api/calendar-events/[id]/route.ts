import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import CalendarEvent from "@/lib/models/CalendarEvent";

// רשימה סגורה של שדות שמותר לעדכן - קודם לכן הועבר כל ה-body ישירות ל-$set,
// מה שהיה מאפשר (תיאורטית) לשלוח workspaceId בבקשה ול"להעביר" את האירוע
// ל-workspace אחר (הסינון {_id, workspaceId} מגן רק על מציאת הרשומה, לא על
// השדות שמעדכנים בה).
const ALLOWED_FIELDS = ["title", "date", "notes", "color"];

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
  const event = await CalendarEvent.findOneAndUpdate({ _id: id, workspaceId }, update, {
    new: true,
  });
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
