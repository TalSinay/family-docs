// הגדרת הקטגוריות הראשיות ותתי-הקטגוריות המוצעות (ניתן להוסיף תתי-קטגוריות בזמן העלאה)

export const MAIN_CATEGORIES = [
  "ביטוחים",
  "פיננסים",
  "זיכויים",
  "קבלות",
  "כללי",
  "הוצאות",
  "הכנסות",
] as const;

export type MainCategory = (typeof MAIN_CATEGORIES)[number];

export const DEFAULT_SUBCATEGORIES: Record<MainCategory, string[]> = {
  ביטוחים: ["רכב", "חיים", "שיניים", "דירה"],
  פיננסים: ["בנק", "קרן השתלמות", "קרן פנסיה", "השקעות"],
  זיכויים: ["אופנה", "מוצרי חשמל", "מוצרי תינוקות"],
  קבלות: ["אופנה", "מוצרי חשמל", "מוצרי תינוקות"],
  כללי: ["מסמכים טל", "מסמכים דניאל", "מסמכי הבית"],
  הוצאות: [],
  הכנסות: [],
};

// קטגוריות שבהן יש הצגה של שדה "סכום" ו"תשלום חודשי"
export const FINANCIAL_CATEGORIES: MainCategory[] = ["ביטוחים", "פיננסים", "הוצאות", "הכנסות"];

export const CATEGORY_ICONS: Record<MainCategory, string> = {
  ביטוחים: "shield",
  פיננסים: "landmark",
  זיכויים: "gift",
  קבלות: "receipt",
  כללי: "folder",
  הוצאות: "trending-down",
  הכנסות: "trending-up",
};
