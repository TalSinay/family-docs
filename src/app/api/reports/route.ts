import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";

function monthKey(y: number, m: number) {
  // m: 0-based (כמו getMonth())
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

// מחזיר סיכום הכנסות/הוצאות לפי חודש עבור טווח נתון (from/to בפורמט YYYY-MM, כולל שני הקצוות).
// משמש גם ל"סיכום שנתי" (טווח = ינואר-דצמבר של שנה) וגם לטווח חודשים מותאם אישית.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (
    !fromParam ||
    !toParam ||
    !/^\d{4}-\d{2}$/.test(fromParam) ||
    !/^\d{4}-\d{2}$/.test(toParam)
  ) {
    return NextResponse.json({ error: "יש לספק from ו-to בפורמט YYYY-MM" }, { status: 400 });
  }

  let [fy, fm] = fromParam.split("-").map(Number);
  let [ty, tm] = toParam.split("-").map(Number);
  fm -= 1;
  tm -= 1;

  // תמיכה גם אם הטווח הוזן הפוך
  if (fy > ty || (fy === ty && fm > tm)) {
    [fy, ty] = [ty, fy];
    [fm, tm] = [tm, fm];
  }

  const totalMonths = (ty - fy) * 12 + (tm - fm) + 1;
  if (totalMonths > 60) {
    return NextResponse.json({ error: "טווח ארוך מדי (עד 60 חודשים)" }, { status: 400 });
  }

  await connectToDatabase();

  const rangeStart = new Date(fy, fm, 1);
  const rangeEnd = new Date(ty, tm + 1, 1);

  const [docs, recurringSources] = await Promise.all([
    DocumentModel.find({
      category: { $in: ["הוצאות", "הכנסות"] },
      uploadedAt: { $gte: rangeStart, $lt: rangeEnd },
    })
      .select("category amount uploadedAt")
      .lean(),
    // תשלומים חוזרים שנוצרו לפני סוף הטווח - כדי לחשב תחזית לחודשים שטרם הופקה
    // עבורם רשומה בפועל (אותו היגיון כמו בדשבורד החודשי)
    DocumentModel.find({
      isMonthlyPayment: true,
      monthlyAmount: { $ne: null },
      category: { $in: ["הוצאות", "הכנסות"] },
      uploadedAt: { $lt: rangeEnd },
    })
      .select("category monthlyAmount uploadedAt generatedForMonths")
      .lean(),
  ]);

  const months: { key: string; year: number; month: number }[] = [];
  let cy = fy;
  let cm = fm;
  while (cy < ty || (cy === ty && cm <= tm)) {
    months.push({ key: monthKey(cy, cm), year: cy, month: cm });
    cm++;
    if (cm > 11) {
      cm = 0;
      cy++;
    }
  }

  const buckets = new Map<string, { income: number; expenses: number }>();
  for (const m of months) buckets.set(m.key, { income: 0, expenses: 0 });

  for (const doc of docs) {
    if (typeof doc.amount !== "number") continue;
    const d = new Date(doc.uploadedAt);
    const bucket = buckets.get(monthKey(d.getFullYear(), d.getMonth()));
    if (!bucket) continue;
    if (doc.category === "הכנסות") bucket.income += doc.amount;
    else if (doc.category === "הוצאות") bucket.expenses += doc.amount;
  }

  for (const source of recurringSources) {
    if (typeof source.monthlyAmount !== "number") continue;
    const sourceDate = new Date(source.uploadedAt);
    for (const m of months) {
      const monthStart = new Date(m.year, m.month, 1);
      // המסמך המקורי נוצר באותו חודש או אחריו - הסכום שלו כבר נספר כ"בפועל" (או שעדיין לא רלוונטי)
      if (sourceDate >= monthStart) continue;
      // כבר הופקה רשומה בפועל לחודש הזה ע"י האוטומציה החודשית
      if (source.generatedForMonths?.includes(m.key)) continue;

      const bucket = buckets.get(m.key);
      if (!bucket) continue;
      if (source.category === "הכנסות") bucket.income += source.monthlyAmount;
      else if (source.category === "הוצאות") bucket.expenses += source.monthlyAmount;
    }
  }

  const monthsResult = months.map((m) => {
    const b = buckets.get(m.key)!;
    return { month: m.key, income: b.income, expenses: b.expenses, balance: b.income - b.expenses };
  });

  const totals = monthsResult.reduce(
    (acc, m) => ({ income: acc.income + m.income, expenses: acc.expenses + m.expenses }),
    { income: 0, expenses: 0 }
  );

  return NextResponse.json({
    months: monthsResult,
    totals: { income: totals.income, expenses: totals.expenses, balance: totals.income - totals.expenses },
  });
}
