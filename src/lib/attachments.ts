import mongoose from "mongoose";
import FileModel from "@/lib/models/File";

export type AttachmentInput = {
  fileId: string;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
};

// מסנן מערך attachments שהגיע מהלקוח לכאלה שעברו שני שלבי בדיקה:
// 1. צורה תקינה (שדות מהסוג הנכון).
// 2. הקובץ (fileId) הועלה בפועל ב-workspace הפעיל - כך לא ניתן "לקשר" למסמך קובץ
//    שהועלה ב-workspace אחר (למשל ע"י משתמש שמשויך לכמה workspace-ים), ובכך
//    לדלוף אותו דרך /api/files/[fileId].
export async function sanitizeAttachments(
  raw: unknown,
  workspaceId: string
): Promise<AttachmentInput[]> {
  if (!Array.isArray(raw)) return [];

  const wellFormed = raw.filter(
    (a): a is AttachmentInput =>
      !!a &&
      typeof a.fileId === "string" &&
      mongoose.isValidObjectId(a.fileId) &&
      typeof a.fileName === "string" &&
      typeof a.fileMimeType === "string" &&
      typeof a.fileSize === "number"
  );
  if (wellFormed.length === 0) return [];

  const ownedFiles = await FileModel.find({
    _id: { $in: wellFormed.map((a) => a.fileId) },
    workspaceId,
  })
    .select("_id")
    .lean();
  const ownedIds = new Set(ownedFiles.map((f) => f._id.toString()));

  return wellFormed.filter((a) => ownedIds.has(a.fileId));
}
