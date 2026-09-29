"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, ChevronLeft, TrendingDown, TrendingUp, Scale } from "lucide-react";
import { DocumentCard } from "@/components/DocumentCard";
import { formatCurrency, HEBREW_MONTHS } from "@/lib/format";

type DashboardData = {
  month: string; // "YYYY-MM"
  totalExpenses: number;
  totalIncome: number;
  balance: number;
  recentActivity: {
    _id: string;
    title: string;
    category: string;
    subcategory?: string;
    isImportant?: boolean;
    amount?: number;
    uploadedAt: string;
    uploadedBy?: { name?: string } | null;
  }[];
};

export default function DashboardPage() {
  // "החודש הנוכחי" נקבע רק בדפדפן, כדי שיתאים לאזור הזמן של המשתמש
  // ולא ליצור פער בין ה-HTML הראשוני של השרת לזה של הלקוח.
  const [mounted, setMounted] = useState(false);
  const [cursor, setCursor] = useState(() => new Date());
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- רק קובע "עכשיו" אחרי עליית הרכיב בדפדפן
    setMounted(true);
  }, []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth(); // 0-based
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  const fetchDashboard = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?month=${key}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- טעינת נתונים לפי חודש, לא לולאת render
    fetchDashboard(monthKey);
  }, [mounted, monthKey, fetchDashboard]);

  const isCurrentMonth = mounted && monthKey === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  if (!mounted) {
    return <div className="card p-8 text-center text-sm text-slate-400">טוען דשבורד...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">דשבורד</h1>
          <p className="text-sm text-slate-500">
            {isCurrentMonth ? "סיכום החודש הנוכחי" : "סיכום החודש הנבחר"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="p-1.5 rounded-full hover:bg-slate-100"
            aria-label="חודש קודם"
          >
            <ChevronRight size={20} />
          </button>
          <span className="font-semibold min-w-[6.5rem] text-center">
            {HEBREW_MONTHS[month]} {year}
          </span>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="p-1.5 rounded-full hover:bg-slate-100"
            aria-label="חודש הבא"
          >
            <ChevronLeft size={20} />
          </button>
        </div>
      </div>

      {!isCurrentMonth && (
        <button onClick={() => setCursor(new Date())} className="text-xs text-teal-700 font-medium">
          חזרה לחודש הנוכחי
        </button>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium mb-1">
            <TrendingUp size={14} /> הכנסות
          </div>
          <p className="text-lg font-bold">{formatCurrency(data?.totalIncome ?? 0)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-red-600 text-xs font-medium mb-1">
            <TrendingDown size={14} /> הוצאות
          </div>
          <p className="text-lg font-bold">{formatCurrency(data?.totalExpenses ?? 0)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium mb-1">
            <Scale size={14} /> מאזן
          </div>
          <p
            className={`text-lg font-bold ${
              (data?.balance ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {formatCurrency(data?.balance ?? 0)}
          </p>
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-3">פעילות בחודש זה</h2>
        <div className="space-y-2">
          {loading && <p className="text-sm text-slate-400 text-center py-8">טוען...</p>}
          {!loading && data?.recentActivity.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">
              אין מסמכים בחודש זה.
            </p>
          )}
          {!loading &&
            data?.recentActivity.map((doc) => <DocumentCard key={doc._id} doc={doc} />)}
        </div>
      </div>
    </div>
  );
}
