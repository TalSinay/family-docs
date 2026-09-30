import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel from "@/lib/models/Document";

// Endpoint שמופעל פעם בחודש ע"י GitHub Actions (ראה .github/workflows/monthly-expenses.yml)
// מוגן ב-CRON_SECRET כדי שאף אחד אחר לא יוכל להפעיל אותו.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
  }

  await connectToDatabase();

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthlyDocs = await DocumentModel.find({
    isMonthlyPayment: true,
    generatedForMonths: { $ne: currentMonth },
  });

  const created: string[] = [];

  for (const source of monthlyDocs) {
    if (!source.monthlyAmount) continue;

    await DocumentModel.create({
      workspaceId: source.workspaceId,
      title: `תשלום חודשי - ${source.title}`,
      category: source.category,
      subcategory: source.subcategory,
      notes: `נוצר אוטומטית מ: ${source.title}`,
      amount: source.monthlyAmount,
      isMonthlyPayment: false,
      generatedFromDocId: source._id,
      uploadedBy: source.uploadedBy,
      customFields: [],
    });

    source.generatedForMonths.push(currentMonth);
    await source.save();

    created.push(source.title);
  }

  return NextResponse.json({ month: currentMonth, createdCount: created.length, created });
}
