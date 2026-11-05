// זיהוי הוצאות קבועות מתוך רשומות הוצאה: אותו שם (אחרי ניקוי מספרים/פיסוק), בחודשים נפרדים
// ברצף כמעט חודשי, בסכום יציב. משמש את הכלי "הוצאות קבועות" (שואל אם זו הלוואה).

export type RecurringInput = {
  _id: string;
  title: string;
  subcategory?: string | null;
  amount?: number | null;
  uploadedAt: Date | string;
  isMonthlyPayment?: boolean;
  monthlyAmount?: number | null;
};

export type RecurringCandidate = {
  key: string;
  title: string; // השם המקורי הנפוץ ביותר
  amount: number; // סכום חודשי טיפוסי
  months: number; // בכמה חודשים נראתה
  firstDate: string; // YYYY-MM-DD
  lastDate: string;
  likelyLoan: boolean;
};

const MIN_MONTHS = 3;
const STABLE_RATIO = 0.6; // לפחות 60% מהחודשים באותו סכום (±2%)
const LOAN_WORDS = ["הלוואה", "הלוואת", "הלואה", "הלוואות", "משכנתא", "משכנתה", "מימון", "ליסינג", "פריסה", "loan"];

export function normalizeTitle(raw: string): string {
  return raw
    .replace(/^תשלום חודשי\s*-\s*/, "") // הרשומות שהאוטומציה החודשית יוצרת
    .toLowerCase()
    .replace(/[\d₪.,/\\\-_:;"'׳״()[\]{}*#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function day(d: Date | string) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

function monthIndex(dateStr: string) {
  const [y, m] = dateStr.split("-").map(Number);
  return y * 12 + (m - 1);
}

export function detectRecurring(docs: RecurringInput[], todayStr: string): RecurringCandidate[] {
  const groups = new Map<string, RecurringInput[]>();
  for (const d of docs) {
    const key = normalizeTitle(d.title);
    if (key.length < 2) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }

  const out: RecurringCandidate[] = [];
  const nowIdx = monthIndex(todayStr);

  for (const [key, list] of groups) {
    // חודש -> הסכום (אם כמה רשומות באותו חודש, הראשונה)
    const byMonth = new Map<number, { amount: number; date: string }>();
    for (const d of list.sort((a, b) => +new Date(a.uploadedAt) - +new Date(b.uploadedAt))) {
      const amount = typeof d.amount === "number" ? d.amount : null;
      if (amount === null || amount <= 0) continue;
      const date = day(d.uploadedAt);
      const idx = monthIndex(date);
      if (!byMonth.has(idx)) byMonth.set(idx, { amount, date });
    }
    const marked = list.find((d) => d.isMonthlyPayment && typeof d.monthlyAmount === "number");

    const months = [...byMonth.keys()].sort((a, b) => a - b);
    let amount: number | null = null;
    const monthsSeen = months.length;
    let first = months.length ? byMonth.get(months[0])!.date : "";
    let last = months.length ? byMonth.get(months[months.length - 1])!.date : "";

    if (months.length >= MIN_MONTHS) {
      // כמעט רצוף: לפחות 3 חודשים בתוך חלון קצר יחסית, והאחרון לא ישן מ-2 חודשים
      if (nowIdx - months[months.length - 1] > 2) {
        if (!marked) continue;
      }
      const span = months[months.length - 1] - months[0] + 1;
      if (months.length / span < 0.6 && !marked) continue;
      // הסכום הנפוץ (±2%)
      const amounts = months.map((m) => byMonth.get(m)!.amount);
      let best = 0;
      let bestAmount = amounts[0];
      for (const a of amounts) {
        const c = amounts.filter((b) => Math.abs(b - a) <= a * 0.02).length;
        if (c > best) {
          best = c;
          bestAmount = a;
        }
      }
      if (best / amounts.length >= STABLE_RATIO) amount = bestAmount;
    }
    if (amount === null && marked) {
      amount = marked.monthlyAmount as number;
      if (!first) first = last = day(marked.uploadedAt);
    }
    if (amount === null) continue;

    const names = new Map<string, number>();
    for (const d of list) names.set(d.title.replace(/^תשלום חודשי\s*-\s*/, ""), (names.get(d.title.replace(/^תשלום חודשי\s*-\s*/, "")) || 0) + 1);
    const title = [...names.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const text = `${title} ${list.map((d) => d.subcategory || "").join(" ")}`.toLowerCase();
    const likelyLoan = LOAN_WORDS.some((w) => text.includes(w));

    out.push({ key, title, amount, months: monthsSeen, firstDate: first, lastDate: last, likelyLoan });
  }

  return out.sort((a, b) => Number(b.likelyLoan) - Number(a.likelyLoan) || b.amount - a.amount);
}
