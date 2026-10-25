"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
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
  UserCircle,
  Bell,
  Home,
  ListChecks,
  CalendarDays,
  Clock,
  Star,
} from "lucide-react";
import { Modal } from "./Modal";
import { MAIN_CATEGORIES } from "@/lib/categories";
import { categoryUi } from "@/lib/categoryTheme";

type IconType = React.ComponentType<{ size?: number; className?: string }>;

const CATEGORY_ICONS: Record<string, IconType> = {
  ביטוחים: Shield,
  פיננסים: Landmark,
  זיכויים: Gift,
  קבלות: Receipt,
  כללי: Folder,
  הוצאות: TrendingDown,
  הכנסות: TrendingUp,
};

type Tile = { href: string; label: string; icon: IconType; color?: string; soft?: string };

// קיצורי הדרך הקבועים - מחליפים את הניווט התחתון הישן (6 פריטים קטנים).
const SHORTCUTS: Tile[] = [
  { href: "/dashboard", label: "בית", icon: Home },
  { href: "/tasks", label: "משימות", icon: ListChecks },
  { href: "/calendar", label: "יומן", icon: CalendarDays },
  { href: "/shopping", label: "קניות", icon: ShoppingCart },
  { href: "/notifications", label: "התראות", icon: Bell },
  { href: "/important", label: "חשובים", icon: Star },
  { href: "/recent", label: "אחרונים", icon: Clock },
  { href: "/apps", label: "האפליקציות שלי", icon: Smartphone },
];

function TileLink({ tile, onClose }: { tile: Tile; onClose: () => void }) {
  const Icon = tile.icon;
  return (
    <Link
      href={tile.href}
      onClick={onClose}
      className="card p-3 flex flex-col items-center gap-2 hover:border-teal-300 transition-colors text-center"
      style={tile.color ? { borderTop: `4px solid ${tile.color}` } : undefined}
    >
      <div
        className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center"
        style={tile.color ? { backgroundColor: tile.soft, color: tile.color } : undefined}
      >
        <Icon size={21} />
      </div>
      <span className="text-sm font-medium leading-tight">{tile.label}</span>
    </Link>
  );
}

// גליון תחתון עם כל האפליקציה, לניווט ידני. נפתח מהכפתור "קטגוריות" בבר התחתון.
export function CategorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: session } = useSession();
  const isOwnerAdmin = session?.user?.role === "admin"; // כמו בעמוד /categories

  const categoryTiles: Tile[] = MAIN_CATEGORIES.map((cat) => {
    const ui = categoryUi(cat);
    return {
      href: `/category/${encodeURIComponent(cat)}`,
      label: cat,
      icon: CATEGORY_ICONS[cat] ?? Folder,
      color: ui.color,
      soft: ui.soft,
    };
  });

  return (
    <Modal open={open} onClose={onClose} title="כל האפליקציה">
      <div className="space-y-5">
        <section>
          <h3 className="text-xs font-bold text-slate-500 mb-2">מסמכים לפי קטגוריה</h3>
          <div className="grid grid-cols-3 gap-2.5">
            {categoryTiles.map((t) => (
              <TileLink key={t.href} tile={t} onClose={onClose} />
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-bold text-slate-500 mb-2">קיצורי דרך</h3>
          <div className="grid grid-cols-3 gap-2.5">
            {SHORTCUTS.map((t) => (
              <TileLink key={t.href} tile={t} onClose={onClose} />
            ))}
            {isOwnerAdmin && (
              <TileLink
                tile={{ href: "/personal", label: "אזור אישי", icon: UserCircle }}
                onClose={onClose}
              />
            )}
          </div>
        </section>
      </div>
    </Modal>
  );
}
