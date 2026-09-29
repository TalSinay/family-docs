import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month"); // צפוי בפורמט "YYYY-MM"

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-based

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month = m - 1;
  }

  await connectToDatabase();

  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);

  const [expensesAgg, incomeAgg, recent, recurringSources] = await Promise.all([
    DocumentModel.aggregate([
      { $match: { category: "הוצאות", uploadedAt: { $gte: monthStart, $lt: monthEnd } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    DocumentModel.aggregate([
      { $match: { category: "הכנסות", uploadedAt: { $gte: monthStart, $lt: monthEnd } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    // "פעילות אחרונה" מוצגת בהתאם לחודש הנבחר, לא רק לחודש הנוכחי
    DocumentModel.find({ uploadedAt: { $gte: monthStart, $lt: monthEnd } })
      .sort({ uploadedAt: -1 })
      .limit(20)
      .populate("uploadedBy", "name")
      .lean(),
    // תשלומים חוזרים שמקורם לפני החודש הזה, ושה-cron החודשי עוד לא הפיק עבורם רשומה
    // בפועל לחודש הזה (ראה .github/workflows/monthly-expenses.yml) - מוצגים כתחזית,
    // כדי שסימון "תשלום חודשי" ישתקף בדשבורד מיידית, גם קדימה בזמן, בלי לחכות ל-1 לחודש.
    DocumentModel.find({
      isMonthlyPayment: true,
      monthlyAmount: { $ne: null },
      category: { $in: ["הוצאות", "הכנסות"] },
      uploadedAt: { $lt: monthStart },
      generatedForMonths: { $ne: monthKey },
    })
      .select("category monthlyAmount")
      .lean(),
  ]);

  let totalExpenses = expensesAgg[0]?.total || 0;
  let totalIncome = incomeAgg[0]?.total || 0;
  let projectedCount = 0;

  for (const source of recurringSources) {
    if (typeof source.monthlyAmount !== "number") continue;
    if (source.category === "הוצאות") totalExpenses += source.monthlyAmount;
    else if (source.category === "הכנסות") totalIncome += source.monthlyAmount;
    projectedCount++;
  }

  return NextResponse.json({
    month: monthKey,
    totalExpenses,
    totalIncome,
    balance: totalIncome - totalExpenses,
    recentActivity: recent,
    projectedCount,
  });
}
