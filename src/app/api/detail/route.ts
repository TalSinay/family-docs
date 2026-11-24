import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import DetailEntry from "@/lib/models/DetailEntry";

// GET ?kind=expenses|income : כל שורות הפירוט מהסוג (לעמוד הפירוט; הסיכומים מחושבים בדפדפן לפי חודש/חשבון)
// GET ?batches=1 : רשימת הקבצים שהועלו לפירוט. DELETE ?batch=<id> : מחיקת קובץ שלם.
export async function GET(req: NextRequest) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;
  await connectToDatabase();
  const sp = new URL(req.url).searchParams;

  if (sp.get("batches")) {
    const rows = await DetailEntry.find({ workspaceId })
      .select("kind account amount date importBatchId importFileName createdAt")
      .lean();
    const map = new Map<
      string,
      { id: string; account: string; fileName: string; importedAt: string; expenses: number; income: number; from: string; to: string }
    >();
    for (const r of rows) {
      let b = map.get(r.importBatchId);
      if (!b) {
        b = {
          id: r.importBatchId,
          account: r.account,
          fileName: r.importFileName || "",
          importedAt: new Date(r.createdAt).toISOString(),
          expenses: 0,
          income: 0,
          from: r.date,
          to: r.date,
        };
        map.set(r.importBatchId, b);
      }
      if (r.kind === "הוצאות") b.expenses++;
      else b.income++;
      if (r.date < b.from) b.from = r.date;
      if (r.date > b.to) b.to = r.date;
    }
    return NextResponse.json([...map.values()].sort((a, b) => b.importedAt.localeCompare(a.importedAt)));
  }

  const kind = sp.get("kind") === "income" ? "הכנסות" : "הוצאות";
  const rows = await DetailEntry.find({ workspaceId, kind })
    .select("title amount date account")
    .sort({ date: -1 })
    .limit(30000)
    .lean();
  return NextResponse.json(
    rows.map((r) => ({ id: String(r._id), title: r.title, amount: r.amount, date: r.date, account: r.account }))
  );
}

export async function DELETE(req: NextRequest) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;
  const batch = new URL(req.url).searchParams.get("batch") || "";
  if (!/^[a-f0-9]{24}$/.test(batch)) {
    return NextResponse.json({ error: "מזהה ייבוא לא תקין" }, { status: 400 });
  }
  await connectToDatabase();
  const res = await DetailEntry.deleteMany({ workspaceId, importBatchId: batch });
  return NextResponse.json({ deleted: res.deletedCount });
}
