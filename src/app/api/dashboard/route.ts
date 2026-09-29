import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await connectToDatabase();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [expensesAgg, incomeAgg, recent] = await Promise.all([
    DocumentModel.aggregate([
      { $match: { category: "הוצאות", uploadedAt: { $gte: monthStart, $lt: monthEnd } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    DocumentModel.aggregate([
      { $match: { category: "הכנסות", uploadedAt: { $gte: monthStart, $lt: monthEnd } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    DocumentModel.find()
      .sort({ uploadedAt: -1 })
      .limit(8)
      .populate("uploadedBy", "name")
      .lean(),
  ]);

  const totalExpenses = expensesAgg[0]?.total || 0;
  const totalIncome = incomeAgg[0]?.total || 0;

  return NextResponse.json({
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    totalExpenses,
    totalIncome,
    balance: totalIncome - totalExpenses,
    recentActivity: recent,
  });
}
