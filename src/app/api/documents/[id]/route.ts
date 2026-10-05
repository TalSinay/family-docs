import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel, { MAX_AMOUNT_HISTORY } from "@/lib/models/Document";
import { overlayUploaderDisplayNames } from "@/lib/resolveDisplayNames";
import { sanitizeAttachments } from "@/lib/attachments";
import { numOrNull, sanitizeFinanceFields } from "@/lib/financeFields";

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
    "attachments",
    "fileId", // כדי לאפשר ניקוי קובץ הישן-הבודד (מסמכים שנוצרו לפני תמיכה ב-attachments)
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) update[key] = body[key];
  }
  // "" נשלח כדי לנקות תאריך יעד קיים
  if (update.dueDate === "") update.dueDate = null;

  await connectToDatabase();

  // כמו ב-POST: מסננים attachments לכאלה שהועלו בפועל ב-workspace הפעיל, כדי
  // שלא ניתן יהיה "לקשר" קובץ שהועלה ב-workspace אחר למסמך קיים.
  if ("attachments" in update) {
    update.attachments = await sanitizeAttachments(update.attachments, workspaceId);
  }
  // fileId (הקובץ הבודד הישן) ניתן לניקוי בלבד מהנתיב הזה - לא לקביעה לערך חדש,
  // כדי שלא ניתן יהיה "לקשר" קובץ זר דרך השדה הישן הזה.
  if ("fileId" in update && update.fileId) {
    delete update.fileId;
  }

  // שדות פיננסים (שם פלטפורמה, תשואה, עמלה, יעד, התחייבות) - מנוקים בנפרד
  const finance = sanitizeFinanceFields(body);

  // סכום: ערך מספרי תקין בלבד (null מנקה)
  if ("amount" in update) {
    const n = numOrNull(update.amount);
    if (n === undefined) delete update.amount;
    else update.amount = n;
  }

  // כשהסכום של רשומת פיננסים משתנה - שומרים אותו בהיסטוריה (כולל הערך הקודם אם
  // זו הפעם הראשונה), כדי להציג "שינוי מהעדכון הקודם". שדות פיננסים ייעודיים
  // נשמרים רק לרשומות בקטגוריית פיננסים.
  let historyPush: Record<string, unknown> | undefined;
  if (typeof update.amount === "number" || Object.keys(finance).length) {
    const existing = await DocumentModel.findOne({ _id: id, workspaceId }).select(
      "category amount amountHistory uploadedAt"
    );
    if (existing && existing.category === "פיננסים") {
      Object.assign(update, finance);
      if (typeof update.amount === "number" && existing.amount !== update.amount) {
        const entries: { amount: number; at: Date }[] = [];
        if (!existing.amountHistory?.length && typeof existing.amount === "number") {
          entries.push({ amount: existing.amount, at: existing.uploadedAt });
        }
        entries.push({ amount: update.amount, at: new Date() });
        historyPush = { amountHistory: { $each: entries, $slice: -MAX_AMOUNT_HISTORY } };
      }
    }
  }

  const doc = await DocumentModel.findOneAndUpdate(
    { _id: id, workspaceId },
    historyPush ? { $set: update, $push: historyPush } : update,
    { new: true }
  );
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
