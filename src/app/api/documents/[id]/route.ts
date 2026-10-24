import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel, { MAX_AMOUNT_HISTORY } from "@/lib/models/Document";
import { overlayUploaderDisplayNames } from "@/lib/resolveDisplayNames";
import { sanitizeAttachments } from "@/lib/attachments";
import { numOrNull, sanitizeFinanceFields } from "@/lib/financeFields";
import { isValidTime } from "@/lib/israelTime";
import SubCategory from "@/lib/models/SubCategory";
import { MAIN_CATEGORIES } from "@/lib/categories";

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
    "category",
    "uploadedAt",
    "dueDate",
    "dueDateTitle",
    "notifyTime",
    "attachments",
    "fileId", // כדי לאפשר ניקוי קובץ הישן-הבודד (מסמכים שנוצרו לפני תמיכה ב-attachments)
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) update[key] = body[key];
  }
  // שם: לא ריק
  if ("title" in update) {
    const t = String(update.title ?? "").trim();
    if (!t) return NextResponse.json({ error: "השם לא יכול להיות ריק" }, { status: 400 });
    update.title = t;
  }
  // קטגוריה: רק קטגוריה ראשית מוכרת
  if ("category" in update && !(MAIN_CATEGORIES as readonly string[]).includes(String(update.category))) {
    return NextResponse.json({ error: "קטגוריה לא מוכרת" }, { status: 400 });
  }
  // תאריך הרשומה (למשל תאריך הוצאה): תאריך תקין שאינו בעתיד הרחוק
  if ("uploadedAt" in update) {
    const t = Date.parse(String(update.uploadedAt));
    if (Number.isNaN(t) || t > Date.now() + 36 * 3600 * 1000) delete update.uploadedAt;
    else update.uploadedAt = new Date(t);
  }
  if ("subcategory" in update) update.subcategory = String(update.subcategory ?? "").trim() || null;
  // "" נשלח כדי לנקות תאריך יעד קיים
  if (update.dueDate === "") update.dueDate = null;
  if ("notifyTime" in update) {
    if (update.notifyTime === "" || update.notifyTime === null) update.notifyTime = null;
    else if (!isValidTime(update.notifyTime)) {
      return NextResponse.json({ error: "שעה לא תקינה (פורמט HH:MM)" }, { status: 400 });
    }
  }
  // שינוי תאריך/שעה מתזמן מחדש את ההתראה - מאפשרים לה להישלח שוב
  if ("dueDate" in update || "notifyTime" in update) update.lastNotifiedOn = null;

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
  if ("amount" in update || "category" in update || "subcategory" in update || Object.keys(finance).length) {
    const existing = await DocumentModel.findOne({ _id: id, workspaceId }).select(
      "category isBank amount amountHistory uploadedAt"
    );
    // יתרת הבנק מנוהלת רק דרך /api/bank (מצב ידני/אוטומטי); גם הקטגוריה שלה קבועה
    if (existing?.isBank) {
      delete update.amount;
      delete update.category;
    }
    // תת-קטגוריה חדשה נשמרת לרשימה, כמו ביצירה
    if (typeof update.subcategory === "string" && update.subcategory) {
      const cat = String(update.category ?? existing?.category ?? "");
      if (cat) {
        await SubCategory.updateOne(
          { workspaceId, category: cat, name: update.subcategory },
          { $setOnInsert: { workspaceId, category: cat, name: update.subcategory } },
          { upsert: true }
        );
      }
    }
    if (existing && existing.category === "פיננסים") {
      Object.assign(update, finance);
      if (existing.isBank) {
        delete update.isLiability;
      }
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
