import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/requireWorkspace";
import { connectToDatabase } from "@/lib/mongodb";
import QuickAddWord from "@/lib/models/QuickAddWord";
import { normalizeWord } from "@/lib/quickAdd/parse";
import { MAIN_CATEGORIES } from "@/lib/categories";

const INTENTS = ["expense", "income", "task", "reminder", "shopping", "question", "document"];
const MAX_WORDS_PER_WORKSPACE = 500;

// מילים שהמשפחה לימדה את ההוספה המהירה
export async function GET() {
  const { workspaceId, error } = await requireWorkspace();
  if (error) return error;
  await connectToDatabase();
  const words = await QuickAddWord.find({ workspaceId }).select("word intent category").lean();
  return NextResponse.json(
    words.map((w) => ({ id: String(w._id), word: w.word, intent: w.intent, category: w.category }))
  );
}

// לימוד מילה/ביטוי: { word, intent? , category? } - כוונה ו/או קטגוריית מסמך. אם הביטוי
// כבר קיים, הערכים שלו מתעדכנים.
export async function POST(req: NextRequest) {
  const { session, workspaceId, error } = await requireWorkspace();
  if (error) return error;

  const body = await req.json();
  const word = normalizeWord(String(body.word ?? "")).replace(/\s+/g, " ").trim();
  const intent = body.intent ? String(body.intent) : "";
  const category = body.category ? String(body.category) : "";
  if (!word || word.length > 40 || word.split(" ").length > 3) {
    return NextResponse.json({ error: "ביטוי לא תקין (עד 3 מילים)" }, { status: 400 });
  }
  if (!intent && !category) {
    return NextResponse.json({ error: "חסרה כוונה או קטגוריה" }, { status: 400 });
  }
  if (intent && !INTENTS.includes(intent)) {
    return NextResponse.json({ error: "כוונה לא מוכרת" }, { status: 400 });
  }
  if (category && !(MAIN_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: "קטגוריה לא מוכרת" }, { status: 400 });
  }

  await connectToDatabase();
  const count = await QuickAddWord.countDocuments({ workspaceId });
  const existing = await QuickAddWord.findOne({ workspaceId, word });
  if (!existing && count >= MAX_WORDS_PER_WORKSPACE) {
    return NextResponse.json({ error: "הגעת למספר המקסימלי של מילים" }, { status: 400 });
  }

  const doc = await QuickAddWord.findOneAndUpdate(
    { workspaceId, word },
    { $set: { ...(intent ? { intent } : {}), ...(category ? { category } : {}) }, $setOnInsert: { workspaceId, word, createdBy: session!.user.id } },
    { upsert: true, new: true }
  );
  return NextResponse.json({ id: String(doc._id), word: doc.word, intent: doc.intent, category: doc.category }, { status: 201 });
}
