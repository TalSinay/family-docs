import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import DocumentModel, { MAX_AMOUNT_HISTORY } from "@/lib/models/Document";
import { computeBankEffective, currentMonthIsrael } from "@/lib/bank";

// רשומת הבנק הקבועה של ה-workspace. שתי דרכים לעדכן את היתרה:
//  - ידני (bankAutoSync=false): amount הוא היתרה כפי שהוזנה.
//  - אוטומטי (bankAutoSync=true): amount הוא היתרה לתחילת החודש הנוכחי (חודש הבסיס),
//    והיתרה המוצגת = amount + מאזן (הכנסות-הוצאות) מחודש הבסיס ועד היום.
// הזנת סכום חדש במצב אוטומטי מאפסת את חודש הבסיס לחודש הנוכחי.

async function findBank(workspaceId: string) {
  return DocumentModel.findOne({ workspaceId, category: "פיננסים", isBank: true });
}

export async function POST(req: NextRequest) {
  const { session, workspaceId, error } = await requireWorkspace();
  if (error) return error;
  const body = await req.json();
  const amount = Number(body.amount);
  if (!Number.isFinite(amount)) {
    return NextResponse.json({ error: "יש להזין סכום תקין" }, { status: 400 });
  }
  await connectToDatabase();
  if (await findBank(workspaceId!)) {
    return NextResponse.json({ error: "רשומת בנק כבר קיימת" }, { status: 409 });
  }
  const autoSync = body.autoSync === true;
  const doc = await DocumentModel.create({
    workspaceId,
    title: "בנק",
    category: "פיננסים",
    subcategory: "בנק",
    isBank: true,
    amount,
    bankAutoSync: autoSync,
    bankBaseMonth: autoSync ? currentMonthIsrael() : undefined,
    amountHistory: [{ amount, at: new Date() }],
    uploadedBy: session!.user.id,
  });
  return NextResponse.json(doc, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;
  const body = await req.json();
  await connectToDatabase();

  const bank = await findBank(workspaceId!);
  if (!bank) return NextResponse.json({ error: "רשומת בנק לא נמצאה" }, { status: 404 });

  const nowMonth = currentMonthIsrael();

  if (typeof body.autoSync === "boolean" && body.autoSync !== !!bank.bankAutoSync) {
    if (body.autoSync) {
      // הפעלה: היתרה הנוכחית נקבעת כבסיס לתחילת החודש הנוכחי
      bank.bankAutoSync = true;
      bank.bankBaseMonth = nowMonth;
    } else {
      // כיבוי: "מקפיאים" את היתרה המחושבת כסכום ידני
      const { effective } = await computeBankEffective(workspaceId!, bank);
      bank.amount = effective;
      bank.bankAutoSync = false;
      bank.bankBaseMonth = undefined;
    }
  }

  if ("amount" in body) {
    const n = Number(body.amount);
    if (body.amount === null || body.amount === "" || !Number.isFinite(n)) {
      return NextResponse.json({ error: "יש להזין סכום תקין" }, { status: 400 });
    }
    bank.amount = n;
    if (bank.bankAutoSync) bank.bankBaseMonth = nowMonth;
  }

  // היסטוריה: היתרה האפקטיבית אחרי העדכון
  const { effective } = await computeBankEffective(workspaceId!, bank);
  const last = bank.amountHistory?.[bank.amountHistory.length - 1];
  if (!last || last.amount !== effective) {
    bank.amountHistory = [...(bank.amountHistory || []), { amount: effective, at: new Date() }].slice(
      -MAX_AMOUNT_HISTORY
    );
  }

  await bank.save();
  return NextResponse.json({ ...bank.toObject(), effectiveAmount: effective });
}
