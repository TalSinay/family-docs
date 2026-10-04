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

export type ShoppingItemInput = {
  _id?: string;
  name: string;
  quantity: number;
  imageFileId?: string;
  inCart: boolean;
};

// כמו sanitizeAttachments, אבל לפריטי רשימת קניות: שם/כמות/inCart מנורמלים,
// ו-imageFileId (אופציונלי) מתקבל רק אם הקובץ באמת הועלה ב-workspace הפעיל.
export async function sanitizeShoppingItems(
  raw: unknown,
  workspaceId: string
): Promise<ShoppingItemInput[]> {
  if (!Array.isArray(raw)) return [];

  const wellFormed = raw.filter(
    (it): it is Record<string, unknown> =>
      !!it && typeof it === "object" && typeof (it as Record<string, unknown>).name === "string"
  );
  if (wellFormed.length === 0) return [];

  const candidateImageIds = wellFormed
    .map((it) => it.imageFileId)
    .filter((id): id is string => typeof id === "string" && mongoose.isValidObjectId(id));

  let ownedImageIds = new Set<string>();
  if (candidateImageIds.length > 0) {
    const ownedFiles = await FileModel.find({ _id: { $in: candidateImageIds }, workspaceId })
      .select("_id")
      .lean();
    ownedImageIds = new Set(ownedFiles.map((f) => f._id.toString()));
  }

  return wellFormed
    .map((it) => {
      const name = String(it.name).trim();
      const quantityRaw = typeof it.quantity === "number" ? it.quantity : Number(it.quantity);
      const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.floor(quantityRaw) : 1;
      const imageFileId =
        typeof it.imageFileId === "string" && ownedImageIds.has(it.imageFileId)
          ? it.imageFileId
          : undefined;
      const _id =
        typeof it._id === "string" && mongoose.isValidObjectId(it._id) ? it._id : undefined;
      return { _id, name, quantity, imageFileId, inCart: !!it.inCart };
    })
    .filter((it) => it.name.length > 0);
}
