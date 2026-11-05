// הלוואות בפיננסים: רשומה בקטגוריה "פיננסים" עם תת-קטגוריה "הלוואה" (והתחייבות).
// amount = סכום ההלוואה המקורי; הירידה החודשית באותו יום בחודש כמו תאריך ההתחלה, עד תאריך הסיום (כולל).
export const LOAN_SUBCATEGORY = "הלוואה";

export type LoanInput = {
  amount?: number | null;
  loanStartDate?: string | null;
  loanEndDate?: string | null;
  loanMonthlyPayment?: number | null;
};

export type LoanStats = {
  totalPayments: number;
  paidPayments: number;
  remainingPayments: number;
  remainingBalance: number; // יתרה משוערת (קרן, ביחס ליחס התשלומים שנותרו)
  monthsLeft: number; // חודשים מהיום עד הסיום (0 אם הסתיימה)
  ended: boolean;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parts(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

function paymentDate(start: string, i: number): string {
  const { y, m, d } = parts(start);
  const idx = m - 1 + i;
  const yy = y + Math.floor(idx / 12);
  const mm = ((idx % 12) + 12) % 12;
  const last = new Date(yy, mm + 1, 0).getDate();
  return `${yy}-${String(mm + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

export function isLoanDoc(d: { subcategory?: string | null }): boolean {
  return d.subcategory === LOAN_SUBCATEGORY;
}

export function loanStats(l: LoanInput, today: string): LoanStats | null {
  const start = l.loanStartDate;
  const end = l.loanEndDate;
  if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end) || end < start) return null;
  const s = parts(start);
  const e = parts(end);
  const total = (e.y - s.y) * 12 + (e.m - s.m) + 1;
  let paid = 0;
  for (let i = 0; i < total; i++) if (paymentDate(start, i) <= today) paid++;
  const remaining = total - paid;
  const original = typeof l.amount === "number" ? l.amount : (l.loanMonthlyPayment ?? 0) * total;
  const t = parts(today);
  const monthsLeft = end > today ? Math.max(0, (e.y - t.y) * 12 + (e.m - t.m)) : 0;
  return {
    totalPayments: total,
    paidPayments: paid,
    remainingPayments: remaining,
    remainingBalance: Math.round(original * (remaining / total)),
    monthsLeft,
    ended: remaining === 0,
  };
}

// "YYYY-MM-DD" + n חודשים, באותו יום בחודש (מוגבל לאורך החודש החדש)
export function addMonthsStr(dateStr: string, n: number): string {
  return paymentDate(dateStr, n);
}

// מספר התשלומים מהתחלה ועד סיום (כולל), או null אם התאריכים לא תקינים
export function countPayments(start: string, end: string): number | null {
  if (!DATE_RE.test(start) || !DATE_RE.test(end) || end < start) return null;
  const s = parts(start);
  const e = parts(end);
  return (e.y - s.y) * 12 + (e.m - s.m) + 1;
}
