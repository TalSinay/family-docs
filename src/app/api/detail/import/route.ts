import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import DetailEntry from "@/lib/models/DetailEntry";

const MAX_ENTRIES = 5000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Entry = { title: string; amount: number; date: string; kind: "הוצאות" | "הכנסות" };

function signature(account: string, e: Entry) {
  return `${account}|${e.kind}|${e.date}|${Math.round(e.amount * 100)}|${e.title.trim().toLowerCase()}`;
}

// ייבוא לפירוט בלבד: נשמר באוסף נפרד (DetailEntry) ולא משפיע על ההוצאות/הכנסות החודשיות.
// דה-דופליקציה לפי ספירה: אם אותה תנועה כבר קיימת N פעמים (באותו חשבון, תאריך, סכום ושם) ובקובץ יש
// אותה M פעמים - נוספות max(0, M-N). כך העלאה חופפת לא מכפילה, וקניות זהות באותו יום נשמרות.
export async function POST(req: NextRequest) {
  try {
    const { workspaceId, error } = await requireWorkspace();
    if (error) return error;
    const { entries, account, fileName } = (await req.json()) as {
      entries?: unknown;
      account?: string;
      fileName?: string;
    };

    const acc = String(account || "").trim().slice(0, 80);
    if (!acc) return NextResponse.json({ error: "חסר שם חשבון" }, { status: 400 });
    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "לא נשלחו רשומות לייבוא" }, { status: 400 });
    }
    if (entries.length > MAX_ENTRIES) {
      return NextResponse.json({ error: `אפשר לייבא עד ${MAX_ENTRIES} רשומות בפעם אחת` }, { status: 400 });
    }

    const valid: Entry[] = [];
    for (const raw of entries) {
      const e = raw as Partial<Entry>;
      const title = String(e.title || "").trim().slice(0, 200);
      const amount = Number(e.amount);
      const date = String(e.date || "");
      const kind = e.kind === "הכנסות" ? "הכנסות" : e.kind === "הוצאות" ? "הוצאות" : null;
      if (!title || !kind || !Number.isFinite(amount) || amount <= 0 || !DATE_RE.test(date)) continue;
      valid.push({ title, amount, date, kind });
    }
    if (valid.length === 0) {
      return NextResponse.json({ error: "אף רשומה לא עברה ולידציה תקינה" }, { status: 400 });
    }

    await connectToDatabase();
    const dates = valid.map((v) => v.date).sort();
    const existing = await DetailEntry.find({
      workspaceId,
      account: acc,
      date: { $gte: dates[0], $lte: dates[dates.length - 1] },
    })
      .select("kind title amount date")
      .lean();

    const have = new Map<string, number>();
    for (const d of existing) {
      const s = signature(acc, { title: d.title, amount: d.amount, date: d.date, kind: d.kind });
      have.set(s, (have.get(s) || 0) + 1);
    }

    const batchId = new mongoose.Types.ObjectId().toString();
    const toCreate: Record<string, unknown>[] = [];
    let skipped = 0;
    for (const e of valid) {
      const s = signature(acc, e);
      const left = have.get(s) || 0;
      if (left > 0) {
        have.set(s, left - 1); // מתאים לרשומה קיימת - מדלגים
        skipped++;
        continue;
      }
      toCreate.push({
        workspaceId,
        kind: e.kind,
        account: acc,
        title: e.title,
        amount: e.amount,
        date: e.date,
        importBatchId: batchId,
        importFileName: typeof fileName === "string" ? fileName.slice(0, 200) : undefined,
      });
    }

    for (let i = 0; i < toCreate.length; i += 500) {
      await DetailEntry.insertMany(toCreate.slice(i, i + 500));
    }
    return NextResponse.json({ created: toCreate.length, skipped, total: valid.length, batchId });
  } catch (e) {
    console.error("detail import failed", e);
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `הייבוא נכשל בשרת: ${detail.slice(0, 300)}` }, { status: 500 });
  }
}
