// ניקוי/אימות שדות הקטגוריה "פיננסים" שמגיעים מהלקוח. מחזיר רק מפתחות שנשלחו
// בפועל, עם ערך תקין (null = ניקוי השדה) - כדי שלא יהיה אפשר להחדיר ערכים חופשיים.

function numOrNull(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function sanitizeFinanceFields(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if ("platformName" in body) {
    const name = typeof body.platformName === "string" ? body.platformName.trim().slice(0, 100) : "";
    out.platformName = name || null;
  }
  for (const key of ["expectedReturn", "commissionFee", "targetAmount"] as const) {
    if (key in body) {
      const n = numOrNull(body[key]);
      if (n !== undefined) out[key] = n;
    }
  }
  for (const key of ["loanStartDate", "loanEndDate"] as const) {
    if (key in body) {
      const v = body[key];
      out[key] = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    }
  }
  if ("loanMonthlyPayment" in body) {
    const n = numOrNull(body.loanMonthlyPayment);
    if (n !== undefined) out.loanMonthlyPayment = n;
  }
  if ("isLiability" in body) out.isLiability = body.isLiability === true;

  return out;
}

export { numOrNull };
