import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import type { Types } from "mongoose";

export function monthKey(y: number, m: number) {
  // m: 0-based (כמו getMonth())
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

// סיכום הכנסות/הוצאות לפי חודש (fm/tm הם 0-based, שני הקצוות כלולים). כולל תחזית
// לתשלומים חוזרים שעדיין לא הופקה עבורם רשומה בפועל. משמש את הדוחות ואת יתרת הבנק.
export async function computeMonthlyReport(
  workspaceId: string | Types.ObjectId,
  fy: number,
  fm: number,
  ty: number,
  tm: number
) {
  await connectToDatabase();

  const rangeStart = new Date(fy, fm, 1);
  const rangeEnd = new Date(ty, tm + 1, 1);

  const [docs, recurringSources] = await Promise.all([
    DocumentModel.find({
      workspaceId,
      category: { $in: ["הוצאות", "הכנסות"] },
      uploadedAt: { $gte: rangeStart, $lt: rangeEnd },
    })
      .select("category amount uploadedAt")
      .lean(),
    // תשלומים חוזרים שנוצרו לפני סוף הטווח - כדי לחשב תחזית לחודשים שטרם הופקה
    // עבורם רשומה בפועל (אותו היגיון כמו בדשבורד החודשי)
    DocumentModel.find({
      workspaceId,
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

  return {
    months: monthsResult,
    totals: { income: totals.income, expenses: totals.expenses, balance: totals.income - totals.expenses },
  };
}
