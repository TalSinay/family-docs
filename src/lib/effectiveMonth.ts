// הכנסה שנכנסת בסוף החודש (מה-28 ואילך) נספרת כהכנסה של החודש הבא. הוצאות נספרות בחודש שלהן.
// התאריך עצמו לא משתנה - רק החודש שאליו הרשומה נספרת בדשבורד, בדוחות וביתרת הבנק.
export const INCOME_SHIFT_FROM_DAY = 28;

export function effectiveMonthKey(category: string, date: Date): string {
  let y = date.getFullYear();
  let m = date.getMonth(); // 0-based
  if (category === "הכנסות" && date.getDate() >= INCOME_SHIFT_FROM_DAY) {
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

// כמה ימים אחורה צריך להרחיב טווח שאילתה כדי לתפוס הכנסות מסוף החודש הקודם
export const SHIFT_LOOKBACK_DAYS = 4;
