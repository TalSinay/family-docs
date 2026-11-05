import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";
import RecurringDismissal from "@/lib/models/RecurringDismissal";
import { detectRecurring, normalizeTitle } from "@/lib/recurring";
import { israelNow } from "@/lib/israelTime";

// הוצאות קבועות שזוהו ב-14 החודשים האחרונים, בלי אלה שכבר נענו ("לא הלוואה") או הוגדרו כהלוואה.
export async function GET() {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;
  await connectToDatabase();

  const today = israelNow().date;
  const [ty, tm] = today.split("-").map(Number);
  const since = new Date(ty, tm - 1 - 14, 1);

  const [docs, dismissed, loans] = await Promise.all([
    DocumentModel.find({ workspaceId, category: "הוצאות", uploadedAt: { $gte: since } })
      .select("title subcategory amount uploadedAt isMonthlyPayment monthlyAmount")
      .limit(5000)
      .lean(),
    RecurringDismissal.find({ workspaceId }).select("key").lean(),
    DocumentModel.find({ workspaceId, category: "פיננסים", subcategory: "הלוואה" }).select("title loanSourceKey").lean(),
  ]);

  const skip = new Set<string>([
    ...dismissed.map((d: { key: string }) => d.key),
    ...loans.map((l) => l.loanSourceKey).filter((k): k is string => !!k),
    // הלוואה שהוזנה ידנית באותו שם: גם לא שואלים עליה
    ...loans.map((l) => normalizeTitle(l.title)),
  ]);

  const candidates = detectRecurring(
    docs.map((d) => ({
      _id: String(d._id),
      title: d.title,
      subcategory: d.subcategory,
      amount: d.amount,
      uploadedAt: d.uploadedAt,
      isMonthlyPayment: d.isMonthlyPayment,
      monthlyAmount: d.monthlyAmount,
    })),
    today
  ).filter((c) => !skip.has(c.key));

  return NextResponse.json(candidates);
}

// "לא הלוואה" - מסמן שלא לשאול שוב על ההוצאה הזו
export async function POST(req: NextRequest) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;
  const { key } = await req.json();
  if (typeof key !== "string" || !key.trim() || key.length > 200) {
    return NextResponse.json({ error: "מפתח לא תקין" }, { status: 400 });
  }
  await connectToDatabase();
  await RecurringDismissal.updateOne({ workspaceId, key }, { $setOnInsert: { workspaceId, key } }, { upsert: true });
  return NextResponse.json({ ok: true });
}
