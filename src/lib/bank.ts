import type { Types } from "mongoose";
import { computeMonthlyReport } from "@/lib/monthlyReport";

const MAX_SYNC_MONTHS = 60;

// החודש הנוכחי לפי שעון ישראל (השרת רץ ב-UTC), בפורמט YYYY-MM
export function currentMonthIsrael(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" })
    .format(new Date())
    .slice(0, 7);
}

type BankDocLike = {
  amount?: number | null;
  bankAutoSync?: boolean;
  bankBaseMonth?: string;
};

// מאזן הכנסות-הוצאות מחודש הבסיס ועד החודש הנוכחי (כולל). 0 אם הסנכרון כבוי.
export async function computeBankDelta(
  workspaceId: string | Types.ObjectId,
  bank: BankDocLike
): Promise<number> {
  if (!bank.bankAutoSync || !bank.bankBaseMonth) return 0;
  const now = currentMonthIsrael();
  let [fy, fm] = bank.bankBaseMonth.split("-").map(Number);
  const [ty, tm] = now.split("-").map(Number);
  if (fy > ty || (fy === ty && fm > tm)) return 0;
  // הגנה: לא סורקים יותר מ-60 חודשים אחורה
  if ((ty - fy) * 12 + (tm - fm) + 1 > MAX_SYNC_MONTHS) {
    const start = ty * 12 + (tm - 1) - (MAX_SYNC_MONTHS - 1);
    fy = Math.floor(start / 12);
    fm = start % 12 + 1;
  }
  const report = await computeMonthlyReport(workspaceId, fy, fm - 1, ty, tm - 1);
  return report.totals.balance;
}

export async function computeBankEffective(
  workspaceId: string | Types.ObjectId,
  bank: BankDocLike
): Promise<{ effective: number; delta: number }> {
  const delta = await computeBankDelta(workspaceId, bank);
  return { effective: (bank.amount ?? 0) + delta, delta };
}
