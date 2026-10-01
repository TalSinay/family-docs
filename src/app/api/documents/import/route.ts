import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import SubCategory from "@/lib/models/SubCategory";
import { MainCategory } from "@/lib/categories";

type ImportEntry = { title: string; amount: number; date: string };

const MAX_ENTRIES = 3000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ייבוא תפזורת של תנועות (לדוגמה מקובץ CSV שהורדת מ-Max) כרשומות "הוצאות"/"הכנסות".
// מבוסס על קובץ שהמשתמש מעלה ומפרסר בדפדפן שלו (ראה src/app/import/page.tsx) - כאן
// רק מתבצע ולידציה, דה-דופליקציה מול מה שכבר קיים ב-workspace, ויצירה בפועל.
export async function POST(req: NextRequest) {
  const { session, workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const body = await req.json();
  const { entries, subcategory, category } = body as {
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
    if (!title || !Number.isFinite(amount) || amount <= 0 || !DATE_RE.test(date)) continue;
    valid.push({ title, amount, date });
  }

  if (valid.length === 0) {
    return NextResponse.json({ error: "אף רשומה לא עברה ולידציה תקינה" }, { status: 400 });
  }

  await connectToDatabase();

  if (subcategory) {
    await SubCategory.updateOne(
      { workspaceId, category: targetCategory, name: subcategory },
      { $setOnInsert: { workspaceId, category: targetCategory, name: subcategory } },
      { upsert: true }
    );
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
    category: targetCategory,
    uploadedAt: { $gte: minDate, $lt: maxDate },
  })
    .select("title amount uploadedAt")
    .lean();

  const seen = new Set(
    existing.map((d) => signature(d.title, d.amount ?? 0, d.uploadedAt as Date))
  );

  const toCreate: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const entry of valid) {
    const uploadedAt = parseLocalDate(entry.date);
    const sig = signature(entry.title, entry.amount, uploadedAt);
    if (seen.has(sig)) {
      skipped++;
      continue;
    }
    seen.add(sig); // מונע גם כפילות בתוך קובץ הייבוא עצמו
    toCreate.push({
      workspaceId,
      title: entry.title,
      category: targetCategory,
      subcategory: subcategory || undefined,
      notes: "יובא אוטומטית מקובץ תנועות (Max)",
      amount: entry.amount,
      isMonthlyPayment: false,
      uploadedBy: session!.user.id,
      uploadedAt,
      lastOpenedAt: uploadedAt,
    });
  }

  if (toCreate.length > 0) {
    await DocumentModel.insertMany(toCreate);
  }

  return NextResponse.json({
    created: toCreate.length,
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

function signature(title: string, amount: number, date: Date): string {
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
  return `${day}|${Math.round(amount * 100)}|${title.trim().toLowerCase()}`;
}
