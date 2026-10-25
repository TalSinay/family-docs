import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import { overlayUploaderDisplayNames } from "@/lib/resolveDisplayNames";

export async function GET(req: NextRequest) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

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

  // רשומות הוצאה/הכנסה של החודש (לפירוט בלחיצה על הכרטיס, והסכומים נגזרים מהן)
  const [flowDocs, recent, recurringSources] = await Promise.all([
    DocumentModel.find({
      workspaceId,
      category: { $in: ["הוצאות", "הכנסות"] },
      uploadedAt: { $gte: monthStart, $lt: monthEnd },
    })
      .select("title category subcategory amount uploadedAt")
      .sort({ uploadedAt: 1 })
      .limit(500)
      .lean(),
    // "פעילות אחרונה" מוצגת בהתאם לחודש הנבחר, לא רק לחודש הנוכחי
    DocumentModel.find({ workspaceId, uploadedAt: { $gte: monthStart, $lt: monthEnd } })
      .sort({ uploadedAt: -1 })
      .limit(20)
      .populate("uploadedBy", "name")
      .lean(),
    // תשלומים חוזרים שמקורם לפני החודש הזה, ושה-cron החודשי עוד לא הפיק עבורם רשומה
    // בפועל לחודש הזה (ראה .github/workflows/monthly-expenses.yml) - מוצגים כתחזית,
    // כדי שסימון "תשלום חודשי" ישתקף בדשבורד מיידית, גם קדימה בזמן, בלי לחכות ל-1 לחודש.
    DocumentModel.find({
      workspaceId,
      isMonthlyPayment: true,
      monthlyAmount: { $ne: null },
      category: { $in: ["הוצאות", "הכנסות"] },
      uploadedAt: { $lt: monthStart },
      generatedForMonths: { $ne: monthKey },
    })
      .select("title category subcategory monthlyAmount uploadedAt")
      .lean(),
  ]);

  type FlowItem = {
    id: string;
    title: string;
    subcategory?: string;
    amount: number;
    date: string; // ISO
    projected: boolean; // תשלום חודשי קבוע שטרם הופקה עבורו רשומה
  };
  const expenseItems: FlowItem[] = [];
  const incomeItems: FlowItem[] = [];
  let projectedCount = 0;

  for (const d of flowDocs) {
    if (typeof d.amount !== "number") continue;
    const item: FlowItem = {
      id: String(d._id),
      title: d.title,
      subcategory: d.subcategory,
      amount: d.amount,
      date: new Date(d.uploadedAt).toISOString(),
      projected: false,
    };
    (d.category === "הוצאות" ? expenseItems : incomeItems).push(item);
  }

  for (const source of recurringSources) {
    if (typeof source.monthlyAmount !== "number") continue;
    // היום בחודש של התשלום הקבוע, מוגבל לאורך החודש הנבחר
    const day = Math.min(new Date(source.uploadedAt).getDate(), new Date(year, month + 1, 0).getDate());
    const item: FlowItem = {
      id: String(source._id),
      title: source.title,
      subcategory: source.subcategory,
      amount: source.monthlyAmount,
      date: new Date(year, month, day, 12).toISOString(),
      projected: true,
    };
    (source.category === "הוצאות" ? expenseItems : incomeItems).push(item);
    projectedCount++;
  }

  const byDate = (a: FlowItem, b: FlowItem) => a.date.localeCompare(b.date);
  expenseItems.sort(byDate);
  incomeItems.sort(byDate);
  const sum = (items: FlowItem[]) => items.reduce((t, i) => t + i.amount, 0);
  const totalExpenses = sum(expenseItems);
  const totalIncome = sum(incomeItems);

  return NextResponse.json({
    month: monthKey,
    totalExpenses,
    totalIncome,
    balance: totalIncome - totalExpenses,
    recentActivity: await overlayUploaderDisplayNames(workspaceId, recent),
    projectedCount,
    expenseItems,
    incomeItems,
  });
}
