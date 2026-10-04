import Link from "next/link";
import { MAIN_CATEGORIES } from "@/lib/categories";
import {
  Shield,
  Landmark,
  Gift,
  Receipt,
  Folder,
  TrendingDown,
  TrendingUp,
  Smartphone,
  ShoppingCart,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  ביטוחים: Shield,
  פיננסים: Landmark,
  זיכויים: Gift,
  קבלות: Receipt,
  כללי: Folder,
  הוצאות: TrendingDown,
  הכנסות: TrendingUp,
};

export default function CategoriesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">קטגוריות</h1>
      <div className="grid grid-cols-2 gap-3">
        {MAIN_CATEGORIES.map((cat) => {
          const Icon = ICONS[cat];
          return (
            <Link
              key={cat}
              href={`/category/${encodeURIComponent(cat)}`}
              className="card p-5 flex flex-col items-center gap-2 hover:border-teal-300 transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <Icon size={22} />
              </div>
              <span className="font-medium">{cat}</span>
            </Link>
          );
        })}

        {/* קישורים קבועים נוספים, לא חלק ממודל הקטגוריות של המסמכים (זמן/מבנה נתונים
            שונה) - ראו src/app/shopping ו-src/lib/externalApps.ts */}
        <Link
          href="/shopping"
          className="card p-5 flex flex-col items-center gap-2 hover:border-teal-300 transition-colors"
        >
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <ShoppingCart size={22} />
          </div>
          <span className="font-medium">קניות</span>
        </Link>

        <Link
          href="/apps"
          className="card p-5 flex flex-col items-center gap-2 hover:border-teal-300 transition-colors"
        >
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <Smartphone size={22} />
          </div>
          <span className="font-medium">האפליקציות שלי</span>
        </Link>
      </div>
    </div>
  );
}
