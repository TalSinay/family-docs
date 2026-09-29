import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import { DocumentCard } from "@/components/DocumentCard";
import { formatCurrency } from "@/lib/format";
import { TrendingDown, TrendingUp, Scale } from "lucide-react";

export const dynamic = "force-dynamic";

async function getDashboardData() {
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
    DocumentModel.find().sort({ uploadedAt: -1 }).limit(8).populate("uploadedBy", "name").lean(),
  ]);

  return {
    totalExpenses: expensesAgg[0]?.total || 0,
    totalIncome: incomeAgg[0]?.total || 0,
    recent: JSON.parse(JSON.stringify(recent)),
  };
}

export default async function DashboardPage() {
  const { totalExpenses, totalIncome, recent } = await getDashboardData();
  const balance = totalIncome - totalExpenses;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">דשבורד</h1>
        <p className="text-sm text-slate-500">סיכום החודש הנוכחי</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium mb-1">
            <TrendingUp size={14} /> הכנסות
          </div>
          <p className="text-lg font-bold">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-red-600 text-xs font-medium mb-1">
            <TrendingDown size={14} /> הוצאות
          </div>
          <p className="text-lg font-bold">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium mb-1">
            <Scale size={14} /> מאזן
          </div>
          <p className={`text-lg font-bold ${balance >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {formatCurrency(balance)}
          </p>
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-3">פעילות אחרונה</h2>
        <div className="space-y-2">
          {recent.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">עדיין אין מסמכים. לחץ על &quot;העלה קובץ&quot; כדי להתחיל.</p>
          )}
          {recent.map((doc: { _id: string; [key: string]: unknown }) => (
            <DocumentCard key={doc._id} doc={doc as never} />
          ))}
        </div>
      </div>
    </div>
  );
}
