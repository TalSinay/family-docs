import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import NotificationLog from "@/lib/models/NotificationLog";

// מחיקת רשומה מיומן ההתראות שנשלחו (מוגבל ל-workspace הפעיל)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;
  const { id } = await params;
  await connectToDatabase();
  await NotificationLog.findOneAndDelete({ _id: id, workspaceId });
  return NextResponse.json({ ok: true });
}
