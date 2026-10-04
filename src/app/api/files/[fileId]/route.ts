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

  const file = await FileModel.findById(fileId).lean();
  if (!file) {
    return NextResponse.json({ error: "הקובץ לא נמצא" }, { status: 404 });
  }

  // שלב האימות: כל קובץ שהועלה דרך /api/files/upload (מסמכים, רשימות קניות וכו')
  // נושא מאז workspaceId שנקבע בזמן ההעלאה - בודקים שהוא תואם ל-workspace הפעיל.
  // קבצים ישנים (שהועלו לפני הוספת השדה) לא נושאים אותו - לגביהם, נבדק לחילופין
  // שיש רשומת Document באותו workspace שמצביעה עליו (כקובץ הבודד הישן).
  const authorized = file.workspaceId
    ? file.workspaceId.toString() === workspaceId
    : !!(await DocumentModel.findOne({ workspaceId, fileId }).select("_id").lean());

  if (!authorized) {
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
