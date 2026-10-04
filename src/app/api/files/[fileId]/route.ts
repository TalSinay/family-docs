import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import FileModel from "@/lib/models/File";
import DocumentModel from "@/lib/models/Document";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { fileId } = await params;
  if (!mongoose.isValidObjectId(fileId)) {
    return NextResponse.json({ error: "מזהה קובץ לא תקין" }, { status: 400 });
  }

  await connectToDatabase();

  // שלב האימות: קובץ מוגש רק אם יש רשומת Document שמצביעה עליו (כקובץ הבודד הישן
  // או כאחד מה-attachments), וששייכת ל-workspace הפעיל של המשתמש - כך אי אפשר
  // לגשת לקובץ ששייך ל-workspace אחר.
  const linkedDoc = await DocumentModel.findOne({
    workspaceId,
    $or: [{ fileId }, { "attachments.fileId": fileId }],
  })
    .select("_id")
    .lean();
  if (!linkedDoc) {
    return NextResponse.json({ error: "הקובץ לא נמצא" }, { status: 404 });
  }

  const file = await FileModel.findById(fileId).lean();
  if (!file) {
    return NextResponse.json({ error: "הקובץ לא נמצא" }, { status: 404 });
  }

  const buffer = Buffer.from(file.data.buffer, file.data.byteOffset, file.data.byteLength);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
