import {
  Shield,
  Landmark,
  Gift,
  Receipt,
  Folder,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

// צבע ואיקון לכל קטגוריה ראשית - חוזרים באריחים, בכרטיסי מסמכים ובכותרות, כדי לזהות
// קטגוריה במבט אחד. צבעי hex (ולא מחלקות Tailwind) כדי שאפשר יהיה להשתמש בהם ב-style.
export type CategoryUi = { color: string; soft: string; Icon: LucideIcon };

const CATEGORY_UI: Record<string, CategoryUi> = {
  ביטוחים: { color: "#2563eb", soft: "#dbeafe", Icon: Shield },
  פיננסים: { color: "#059669", soft: "#d1fae5", Icon: Landmark },
  זיכויים: { color: "#7c3aed", soft: "#ede9fe", Icon: Gift },
  קבלות: { color: "#d97706", soft: "#fef3c7", Icon: Receipt },
  כללי: { color: "#64748b", soft: "#e2e8f0", Icon: Folder },
  הוצאות: { color: "#e11d48", soft: "#ffe4e6", Icon: TrendingDown },
  הכנסות: { color: "#0d9488", soft: "#ccfbf1", Icon: TrendingUp },
};

const FALLBACK: CategoryUi = CATEGORY_UI["כללי"];

export function categoryUi(category: string | undefined): CategoryUi {
  return (category && CATEGORY_UI[category]) || FALLBACK;
}
