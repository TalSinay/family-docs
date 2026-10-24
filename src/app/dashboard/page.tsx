"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ChevronRight, ChevronLeft, TrendingDown, TrendingUp, Scale, BarChart3, Upload, AlertCircle, ListChecks, Bell, ShoppingCart } from "lucide-react";
import { DocumentCard } from "@/components/DocumentCard";
import { formatCurrency, HEBREW_MONTHS } from "@/lib/format";

type AttentionItem = {
  kind: "monthly" | "task" | "document";
  id: string;
  name: string;
  label: string;
  nextDate: string;
  time: string;
};

const ATTENTION_DAYS = 3;

function dayDiff(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

function attentionWhen(diff: number, time: string): string {
  if (diff < 0) return `באיחור ${-diff} ימים`;
  if (diff === 0) return `היום · ${time}`;
  if (diff === 1) return `מחר · ${time}`;
  return `בעוד ${diff} ימים`;
}

function attentionHref(item: AttentionItem): string {
  if (item.kind === "task") return "/tasks";
  if (item.kind === "document") return `/documents/${item.id}`;
  return "/notifications";
}

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
  projectedCount: number;
};

export default function DashboardPage() {
  // ה-workspace הפעיל, כדי שמעבר בין workspace-ים ירענן מיד את הדשבורד.
  const { data: session } = useSession();
  const activeWorkspaceId = session?.user?.activeWorkspaceId;

  // "החודש הנוכחי" נקבע רק בדפדפן, כדי שיתאים לאזור הזמן של המשתמש
  // ולא ליצור פער בין ה-HTML הראשוני של השרת לזה של הלקוח.
  const [mounted, setMounted] = useState(false);
  const [cursor, setCursor] = useState(() => new Date());
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [attention, setAttention] = useState<{ item: AttentionItem; diff: number }[]>([]);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- טעינת נתונים לפי חודש/workspace, לא לולאת render
    fetchDashboard(monthKey);
    // activeWorkspaceId בתלויות בכוונה: מעבר workspace מרענן מיד, בלי ניווט מלא.
  }, [mounted, monthKey, fetchDashboard, activeWorkspaceId]);

  // "דורש טיפול": התראות שמתוזמנות להיום או בימים הקרובים (אותם כללים כמו עמוד ההתראות)
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) return;
        const json: { now: { date: string }; scheduled: AttentionItem[] } = await res.json();
        const list = json.scheduled
          .map((item) => ({ item, diff: dayDiff(json.now.date, item.nextDate) }))
          .filter((x) => x.diff <= ATTENTION_DAYS)
          .slice(0, 5);
        if (!cancelled) setAttention(list);
      } catch {
        /* לא קריטי - הסעיף פשוט לא מוצג */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, activeWorkspaceId]);

  const isCurrentMonth = mounted && monthKey === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  if (!mounted) {
    return <div className="card p-8 text-center text-sm text-slate-400">טוען דשבורד...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <p className="text-sm text-slate-500">
            שלום {session?.user?.displayName || session?.user?.name || ""}
          </p>
          <h1 className="text-2xl font-bold leading-tight">מה תרצה לעשות היום?</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { href: "/tasks", label: "משימה חדשה", icon: ListChecks },
            { href: "/notifications", label: "תזכורת חדשה", icon: Bell },
            { href: "/shopping", label: "הוסף לקניות", icon: ShoppingCart },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-sm hover:border-teal-400"
            >
              <Icon size={14} className="text-teal-700" /> {label}
            </Link>
          ))}
        </div>
        {attention.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-slate-500 mb-2">דורש טיפול</h2>
            <div className="space-y-2">
              {attention.map(({ item, diff }) => (
                <Link
                  key={`${item.kind}-${item.id}`}
                  href={attentionHref(item)}
                  className="card p-3 flex items-center gap-3 hover:border-teal-300 transition-colors"
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      diff < 0 ? "bg-red-50 text-red-600" : "bg-teal-50 text-teal-700"
                    }`}
                  >
                    <AlertCircle size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    <p className="text-xs text-slate-500 truncate">{item.label}</p>
                  </div>
                  <span className={`text-xs font-medium shrink-0 ${diff < 0 ? "text-red-600" : "text-slate-500"}`}>
                    {attentionWhen(diff, item.time)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">סיכום חודשי</h2>
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

      <div className="flex items-center justify-between">
        {!isCurrentMonth ? (
          <button onClick={() => setCursor(new Date())} className="text-xs text-teal-700 font-medium">
            חזרה לחודש הנוכחי
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          <Link href="/import" className="flex items-center gap-1 text-xs text-teal-700 font-medium">
            <Upload size={14} /> ייבוא הוצאות מקובץ
          </Link>
          <Link href="/reports" className="flex items-center gap-1 text-xs text-teal-700 font-medium">
            <BarChart3 size={14} /> דוחות שנתיים וטווח מותאם
          </Link>
        </div>
      </div>

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

      {!!data?.projectedCount && (
        <p className="text-xs text-slate-400 -mt-3">
          כולל {data.projectedCount} תשלומים חודשיים קבועים שצפויים בחודש זה (טרם הופקה עבורם רשומה בפועל)
        </p>
      )}

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
