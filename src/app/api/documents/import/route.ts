import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import SubCategory from "@/lib/models/SubCategory";
import { MainCategory } from "@/lib/categories";
import mongoose from "mongoose";

const IMPORT_NOTE = "יובא אוטומטית מקובץ תנועות (Max)";

type ImportEntry = { title: string; amount: number; date: string; category: MainCategory };

const MAX_ENTRIES = 3000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ייבוא תפזורת של תנועות (לדוגמה מקובץ CSV שהורדת מ-Max) כרשומות "הוצאות"/"הכנסות".
// מבוסס על קובץ שהמשתמש מעלה ומפרסר בדפדפן שלו (ראה src/app/import/page.tsx) - כאן
// רק מתבצע ולידציה, דה-דופליקציה מול מה שכבר קיים ב-workspace, ויצירה בפועל.
export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    // שגיאה לא צפויה: מחזירים הודעה קריאה (במקום 500 ריק) ורושמים ללוג של השרת
    console.error("import failed", e);
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `הייבוא נכשל בשרת: ${detail.slice(0, 300)}` }, { status: 500 });
  }
}

async function handlePost(req: NextRequest) {
  const { session, workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const body = await req.json();
  const { entries, subcategory, category, fileName } = body as {
    fileName?: string;
    entries?: unknown;
    subcategory?: string;
    category?: MainCategory;
  };

  const targetCategory: MainCategory = category === "הכנסות" ? "הכנסות" : "הוצאות";

  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: "לא נשלחו רשומות לייבוא" }, { status: 400 });
  }
  if (entries.length > MAX_ENTRIES) {
    return NextResponse.json(
      { error: `אפשר לייבא עד ${MAX_ENTRIES} רשומות בפעם אחת` },
      { status: 400 }
    );
  }

  const valid: ImportEntry[] = [];
  for (const raw of entries) {
    const e = raw as Partial<ImportEntry>;
    const title = String(e.title || "").trim();
    const amount = Number(e.amount);
    const date = String(e.date || "");
    // סוג לכל שורה בנפרד (קובץ בנק מכיל גם הוצאות וגם הכנסות); בלי סוג - קטגוריית ברירת המחדל של הבקשה
    const entryCategory: MainCategory = e.category === "הכנסות" || e.category === "הוצאות" ? e.category : targetCategory;
    if (!title || !Number.isFinite(amount) || amount <= 0 || !DATE_RE.test(date)) continue;
    valid.push({ title, amount, date, category: entryCategory });
  }

  if (valid.length === 0) {
    return NextResponse.json({ error: "אף רשומה לא עברה ולידציה תקינה" }, { status: 400 });
  }

  await connectToDatabase();

  if (subcategory) {
    for (const cat of new Set(valid.map((v) => v.category))) {
      await SubCategory.updateOne(
        { workspaceId, category: cat, name: subcategory },
        { $setOnInsert: { workspaceId, category: cat, name: subcategory } },
        { upsert: true }
      );
    }
  }

  // בדיקת כפילויות מול מה שכבר קיים ב-workspace (לדוגמה אם הועלה אותו חודש פעמיים):
  // נטען את כל הרשומות הקיימות מאותה קטגוריה בטווח התאריכים הרלוונטי, ונבנה "חתימה"
  // של תאריך+סכום+שם לכל אחת, כדי להשוות מול הרשומות החדשות.
  const dates = valid.map((e) => e.date).sort();
  const minDate = parseLocalDate(dates[0]);
  const maxDate = parseLocalDate(dates[dates.length - 1]);
  maxDate.setDate(maxDate.getDate() + 1); // כולל את היום האחרון עצמו

  const existing = await DocumentModel.find({
    workspaceId,
    category: { $in: ["הוצאות", "הכנסות"] },
    uploadedAt: { $gte: minDate, $lt: maxDate },
  })
    .select("title category amount uploadedAt")
    .lean();

  const seen = new Set(
    existing.map((d) => signature(d.category, d.title, d.amount ?? 0, d.uploadedAt as Date))
  );

  const batchId = new mongoose.Types.ObjectId().toString();
  const toCreate: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const entry of valid) {
    const uploadedAt = parseLocalDate(entry.date);
    const sig = signature(entry.category, entry.title, entry.amount, uploadedAt);
    if (seen.has(sig)) {
      skipped++;
      continue;
    }
    seen.add(sig); // מונע גם כפילות בתוך קובץ הייבוא עצמו
    toCreate.push({
      workspaceId,
      title: entry.title,
      category: entry.category,
      subcategory: subcategory || undefined,
      notes: IMPORT_NOTE,
      importBatchId: batchId,
      importFileName: typeof fileName === "string" ? fileName.slice(0, 200) : undefined,
      amount: entry.amount,
      isMonthlyPayment: false,
      uploadedBy: session!.user.id,
      uploadedAt,
      lastOpenedAt: uploadedAt,
    });
  }

  if (toCreate.length > 0) {
    // בחבילות, כדי לא להעמיס על פעולה אחת
    for (let i = 0; i < toCreate.length; i += 500) {
      await DocumentModel.insertMany(toCreate.slice(i, i + 500));
    }
  }

  return NextResponse.json({
    batchId,
    created: toCreate.length,
    createdIncome: toCreate.filter((d) => d.category === "הכנסות").length,
    createdExpenses: toCreate.filter((d) => d.category === "הוצאות").length,
    skipped,
    total: valid.length,
  });
}

// "YYYY-MM-DD" -> Date מקומי (לא UTC) בחצות, כדי שלא "יזוז" יום בין אזורי זמן -
// אותה גישה בדיוק כמו בשאר האפליקציה (ראו למשל CalendarView.tsx).
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function signature(category: string, title: string, amount: number, date: Date): string {
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
  return `${category}|${day}|${Math.round(amount * 100)}|${title.trim().toLowerCase()}`;
}

// ---- ייבואים קודמים: רשימה ומחיקה של ייבוא שלם ----
// ייבוא חדש מזוהה לפי importBatchId. ייבואים ישנים (לפני שהמזהה נוסף) מזוהים לפי ההערה
// הקבועה ולפי דקת היצירה (חותמת הזמן שב-_id), ומקבלים מפתח "legacy-<שניות>".

type BatchRow = {
  key: string;
  fileName: string;
  importedAt: string;
  count: number;
  expenses: { count: number; total: number };
  income: { count: number; total: number };
  from: string;
  to: string;
};

// תשלומים חודשיים קבועים (isMonthlyPayment) הם "תבניות" שה-cron מפיק מהן הוצאות, ולכן לא נמחקים בניקוי
const CLEARABLE = { isMonthlyPayment: { $ne: true } };

export async function GET(req: NextRequest) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;
  await connectToDatabase();

  // ?counts=1: כמה הוצאות/הכנסות יימחקו בניקוי כללי
  if (new URL(req.url).searchParams.get("counts")) {
    const [expenses, income] = await Promise.all([
      DocumentModel.countDocuments({ workspaceId, category: "הוצאות", ...CLEARABLE }),
      DocumentModel.countDocuments({ workspaceId, category: "הכנסות", ...CLEARABLE }),
    ]);
    return NextResponse.json({ expenses, income });
  }

  const docs = await DocumentModel.find({
    workspaceId,
    $or: [{ importBatchId: { $exists: true, $ne: null } }, { notes: IMPORT_NOTE }],
  })
    .select("category amount uploadedAt importBatchId importFileName")
    .lean();

  const batches = new Map<string, BatchRow>();
  for (const d of docs) {
    const created = (d._id as mongoose.Types.ObjectId).getTimestamp();
    const key = d.importBatchId || `legacy-${Math.floor(created.getTime() / 60000) * 60}`;
    let b = batches.get(key);
    const day = new Date(d.uploadedAt).toISOString().slice(0, 10);
    if (!b) {
      b = {
        key,
        fileName: d.importFileName || (d.importBatchId ? "" : "ייבוא קודם (ללא שם קובץ)"),
        importedAt: created.toISOString(),
        count: 0,
        expenses: { count: 0, total: 0 },
        income: { count: 0, total: 0 },
        from: day,
        to: day,
      };
      batches.set(key, b);
    }
    b.count++;
    const side = d.category === "הכנסות" ? b.income : b.expenses;
    side.count++;
    side.total += d.amount ?? 0;
    if (day < b.from) b.from = day;
    if (day > b.to) b.to = day;
    if (created.toISOString() < b.importedAt) b.importedAt = created.toISOString();
  }

  const list = [...batches.values()].sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  return NextResponse.json(list);
}

export async function DELETE(req: NextRequest) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;
  const params = new URL(req.url).searchParams;
  const key = params.get("batch") || "";
  await connectToDatabase();

  // ?clear=all|expenses|income: ניקוי כללי של הוצאות והכנסות בלבד. לא נוגע בשאר הקטגוריות
  // (פיננסים - קרן השתלמות/פנסיה/השקעות/הלוואות, תעודות וכו') ולא בתשלומים חודשיים קבועים.
  const clear = params.get("clear");
  if (clear) {
    const categories =
      clear === "all" ? ["הוצאות", "הכנסות"] : clear === "expenses" ? ["הוצאות"] : clear === "income" ? ["הכנסות"] : null;
    if (!categories) return NextResponse.json({ error: "פרמטר ניקוי לא תקין" }, { status: 400 });
    const res = await DocumentModel.deleteMany({ workspaceId, category: { $in: categories }, ...CLEARABLE });
    return NextResponse.json({ deleted: res.deletedCount });
  }

  if (/^legacy-\d+$/.test(key)) {
    const start = Number(key.slice(7));
    const res = await DocumentModel.deleteMany({
      workspaceId,
      notes: IMPORT_NOTE,
      importBatchId: { $exists: false },
      _id: {
        $gte: mongoose.Types.ObjectId.createFromTime(start),
        $lt: mongoose.Types.ObjectId.createFromTime(start + 60),
      },
    });
    return NextResponse.json({ deleted: res.deletedCount });
  }
  if (!/^[a-f0-9]{24}$/.test(key)) {
    return NextResponse.json({ error: "מזהה ייבוא לא תקין" }, { status: 400 });
  }
  const res = await DocumentModel.deleteMany({ workspaceId, importBatchId: key });
  return NextResponse.json({ deleted: res.deletedCount });
}
