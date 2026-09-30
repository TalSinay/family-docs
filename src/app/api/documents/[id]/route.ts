import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import { overlayUploaderDisplayNames } from "@/lib/resolveDisplayNames";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { id } = await params;
  await connectToDatabase();

  // כל צפייה במסמך מעדכנת lastOpenedAt (לצורך "מסמכים אחרונים")
  // מוגבל ל-workspace הפעיל, כדי שלא ניתן יהיה לגשת למסמך של workspace אחר לפי מזהה
  const doc = await DocumentModel.findOneAndUpdate(
    { _id: id, workspaceId },
    { lastOpenedAt: new Date() },
    { new: true }
  ).populate("uploadedBy", "name email");

  if (!doc) return NextResponse.json({ error: "מסמך לא נמצא" }, { status: 404 });
  const [withDisplayName] = await overlayUploaderDisplayNames(workspaceId, [doc.toObject()]);
  return NextResponse.json(withDisplayName);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const allowedFields = [
    "title",
    "notes",
    "externalLink",
    "isImportant",
    "customFields",
    "amount",
    "isMonthlyPayment",
    "monthlyAmount",
    "subcategory",
    "dueDate",
    "dueDateTitle",
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) update[key] = body[key];
  }
  // "" נשלח כדי לנקות תאריך יעד קיים
  if (update.dueDate === "") update.dueDate = null;

  await connectToDatabase();
  const doc = await DocumentModel.findOneAndUpdate({ _id: id, workspaceId }, update, {
    new: true,
  });
  if (!doc) return NextResponse.json({ error: "מסמך לא נמצא" }, { status: 404 });

  return NextResponse.json(doc);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { id } = await params;
  await connectToDatabase();
  await DocumentModel.findOneAndDelete({ _id: id, workspaceId });

  return NextResponse.json({ ok: true });
}
