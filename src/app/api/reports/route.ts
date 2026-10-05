import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { computeMonthlyReport } from "@/lib/monthlyReport";

// מחזיר סיכום הכנסות/הוצאות לפי חודש עבור טווח נתון (from/to בפורמט YYYY-MM, כולל שני הקצוות).
// משמש גם ל"סיכום שנתי" (טווח = ינואר-דצמבר של שנה) וגם לטווח חודשים מותאם אישית.
export async function GET(req: NextRequest) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (
    !fromParam ||
    !toParam ||
    !/^\d{4}-\d{2}$/.test(fromParam) ||
    !/^\d{4}-\d{2}$/.test(toParam)
  ) {
    return NextResponse.json({ error: "יש לספק from ו-to בפורמט YYYY-MM" }, { status: 400 });
  }

  let [fy, fm] = fromParam.split("-").map(Number);
  let [ty, tm] = toParam.split("-").map(Number);
  fm -= 1;
  tm -= 1;

  // תמיכה גם אם הטווח הוזן הפוך
  if (fy > ty || (fy === ty && fm > tm)) {
    [fy, ty] = [ty, fy];
    [fm, tm] = [tm, fm];
  }

  const totalMonths = (ty - fy) * 12 + (tm - fm) + 1;
  if (totalMonths > 60) {
    return NextResponse.json({ error: "טווח ארוך מדי (עד 60 חודשים)" }, { status: 400 });
  }

  return NextResponse.json(await computeMonthlyReport(workspaceId, fy, fm, ty, tm));
}
