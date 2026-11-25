import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import McpToken from "@/lib/models/McpToken";
import DocumentModel from "@/lib/models/Document";
import DetailEntry from "@/lib/models/DetailEntry";
import Insight from "@/lib/models/Insight";
import { effectiveMonthKey, SHIFT_LOOKBACK_DAYS } from "@/lib/effectiveMonth";
import { normalizeTitle } from "@/lib/recurring";
import { isLoanDoc, loanStats } from "@/lib/loans";
import { israelNow } from "@/lib/israelTime";

// שרת MCP (Streamable HTTP, ללא מצב) שמאפשר ל-Claude לקרוא נתוני הוצאות/הכנסות של workspace ולשמור "תובנות"
// שמוצגות בעמוד /insights. האימות הוא בטוקן שבכתובת (claude.ai תומך בחיבור מותאם עם OAuth או בלי אימות בלבד).
// כל הכלים מוגבלים ל-workspace של הטוקן; כלי הכתיבה היחיד (save_insight) כותב רק לאוסף התובנות.

const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const MAX_ROWS = 500;

type Json = Record<string, unknown>;
type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Json };

const TOOLS = [
  {
    name: "get_overview",
    description:
      "סקירה חודשית של הוצאות והכנסות: סכום הוצאות, הכנסות ומאזן לכל חודש, ופילוח הוצאות לפי תת-קטגוריה. source=monthly (ברירת מחדל) הם ההוצאות/ההכנסות החודשיות באפליקציה (הכנסה מה-28 בחודש נספרת לחודש הבא); source=detail הוא פירוט קבצי הבנק/אשראי (עמודי פירוט הוצאות/הכנסות).",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", enum: ["monthly", "detail"] },
        months: { type: "integer", minimum: 1, maximum: 36, description: "כמה חודשים אחורה (ברירת מחדל 12)" },
      },
    },
  },
  {
    name: "list_transactions",
    description: `רשימת תנועות (תאריך, תיאור/בית עסק, סכום) לסוג ולטווח תאריכים. עד ${MAX_ROWS} שורות; להרבה נתונים עדיף top_merchants או get_overview.`,
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["expenses", "income"] },
        source: { type: "string", enum: ["monthly", "detail"] },
        from: { type: "string", description: "YYYY-MM-DD" },
        to: { type: "string", description: "YYYY-MM-DD" },
        merchant: { type: "string", description: "סינון לפי טקסט בשם בית העסק" },
        limit: { type: "integer", minimum: 1, maximum: MAX_ROWS },
      },
      required: ["kind"],
    },
  },
  {
    name: "top_merchants",
    description: "בתי העסק (או מקורות ההכנסה) עם הסכום הגבוה ביותר, מהגבוה לנמוך, עם מספר תנועות. אפשר לסנן לחודש (YYYY-MM) או לטווח.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["expenses", "income"] },
        source: { type: "string", enum: ["monthly", "detail"] },
        month: { type: "string", description: "YYYY-MM" },
        from: { type: "string" },
        to: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      required: ["kind"],
    },
  },
  {
    name: "list_loans",
    description: "הלוואות שהוזנו באפליקציה: סכום, תשלום חודשי, תאריכי התחלה/סיום, ריבית, תשלומים ששולמו ויתרה משוערת.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_insights",
    description: "תובנות קודמות שנשמרו באפליקציה (כותרת ותאריך), כדי לא לשמור כפילויות.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 50 } } },
  },
  {
    name: "save_insight",
    description:
      "שומר תובנה בעמוד 'תובנות' באפליקציה, כדי שהמשתמש יראה אותה שם. כתוב בעברית, בקצרה ובפרקטיות: כותרת קצרה וגוף עם המספרים והמסקנה. אל תמציא מספרים - רק מה שקראת מהכלים.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", maxLength: 120 },
        body: { type: "string", maxLength: 8000 },
        topic: { type: "string", enum: ["הוצאות", "הכנסות", "כללי"] },
      },
      required: ["title", "body"],
    },
  },
];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function str(v: unknown) {
  return typeof v === "string" ? v : "";
}
function clampInt(v: unknown, def: number, min: number, max: number) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}
function round(n: number) {
  return Math.round(n * 100) / 100;
}

type Tx = { date: string; title: string; amount: number; subcategory?: string; month: string };

// טוען תנועות הוצאות/הכנסות מהמקור המבוקש לטווח תאריכים (YYYY-MM-DD, כולל)
async function loadTx(workspaceId: mongoose.Types.ObjectId, kind: "expenses" | "income", source: string, from: string, to: string): Promise<Tx[]> {
  const category = kind === "expenses" ? "הוצאות" : "הכנסות";
  if (source === "detail") {
    const rows = await DetailEntry.find({ workspaceId, kind: category, date: { $gte: from, $lte: to } })
      .select("title amount date")
      .sort({ date: 1 })
      .lean();
    return rows.map((r) => ({ date: r.date, title: r.title, amount: r.amount, month: r.date.slice(0, 7) }));
  }
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const start = new Date(fy, fm - 1, fd - SHIFT_LOOKBACK_DAYS);
  const end = new Date(ty, tm - 1, td + 1);
  const docs = await DocumentModel.find({ workspaceId, category, uploadedAt: { $gte: start, $lt: end } })
    .select("title subcategory amount uploadedAt")
    .sort({ uploadedAt: 1 })
    .lean();
  const out: Tx[] = [];
  for (const d of docs) {
    if (typeof d.amount !== "number") continue;
    const when = new Date(d.uploadedAt);
    const date = ymd(when);
    const month = effectiveMonthKey(category, when);
    // הכנסה שנדחתה לחודש הבא נשארת בטווח לפי החודש האפקטיבי שלה
    const inRange = category === "הכנסות" ? month >= from.slice(0, 7) && month <= to.slice(0, 7) : date >= from && date <= to;
    if (!inRange) continue;
    out.push({ date, title: d.title, amount: d.amount, subcategory: d.subcategory || undefined, month });
  }
  return out;
}

function rangeFromArgs(args: Json): { from: string; to: string } {
  const month = str(args.month);
  if (MONTH_RE.test(month)) {
    const [y, m] = month.split("-").map(Number);
    return { from: `${month}-01`, to: `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}` };
  }
  const from = DATE_RE.test(str(args.from)) ? str(args.from) : "2000-01-01";
  const to = DATE_RE.test(str(args.to)) ? str(args.to) : "2999-12-31";
  return { from, to };
}

async function callTool(workspaceId: mongoose.Types.ObjectId, name: string, args: Json): Promise<unknown> {
  const source = args.source === "detail" ? "detail" : "monthly";
  switch (name) {
    case "get_overview": {
      const months = clampInt(args.months, 12, 1, 36);
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
      const from = ymd(first);
      const to = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      const [exp, inc] = await Promise.all([
        loadTx(workspaceId, "expenses", source, from, to),
        loadTx(workspaceId, "income", source, from, to),
      ]);
      const byMonth = new Map<string, { expenses: number; income: number }>();
      const add = (m: string, k: "expenses" | "income", a: number) => {
        const cur = byMonth.get(m) || { expenses: 0, income: 0 };
        cur[k] += a;
        byMonth.set(m, cur);
      };
      for (const t of exp) add(t.month, "expenses", t.amount);
      for (const t of inc) add(t.month, "income", t.amount);
      const sub = new Map<string, number>();
      for (const t of exp) sub.set(t.subcategory || "ללא תת-קטגוריה", (sub.get(t.subcategory || "ללא תת-קטגוריה") || 0) + t.amount);
      return {
        source,
        currency: "ILS",
        months: [...byMonth.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, v]) => ({ month, expenses: round(v.expenses), income: round(v.income), net: round(v.income - v.expenses) })),
        expensesBySubcategory: source === "monthly" ? [...sub.entries()].sort((a, b) => b[1] - a[1]).map(([name, total]) => ({ name, total: round(total) })) : undefined,
        note: source === "monthly" ? "הכנסה מה-28 בחודש נספרת לחודש הבא" : "נתוני פירוט מקבצי בנק/אשראי; לא נספרים בסיכומים החודשיים",
      };
    }
    case "list_transactions": {
      const kind = args.kind === "income" ? "income" : "expenses";
      const { from, to } = rangeFromArgs(args);
      const limit = clampInt(args.limit, 200, 1, MAX_ROWS);
      const q = str(args.merchant).trim().toLowerCase();
      let rows = await loadTx(workspaceId, kind, source, from, to);
      if (q) rows = rows.filter((t) => t.title.toLowerCase().includes(q));
      rows.sort((a, b) => b.date.localeCompare(a.date));
      return {
        total: rows.length,
        sum: round(rows.reduce((s, t) => s + t.amount, 0)),
        truncated: rows.length > limit,
        transactions: rows.slice(0, limit).map((t) => ({ date: t.date, title: t.title, amount: round(t.amount), subcategory: t.subcategory })),
      };
    }
    case "top_merchants": {
      const kind = args.kind === "income" ? "income" : "expenses";
      const { from, to } = rangeFromArgs(args);
      const limit = clampInt(args.limit, 20, 1, 100);
      const rows = await loadTx(workspaceId, kind, source, from, to);
      const g = new Map<string, { names: Map<string, number>; total: number; count: number }>();
      for (const t of rows) {
        const key = normalizeTitle(t.title) || t.title.trim().toLowerCase();
        const cur = g.get(key) || { names: new Map(), total: 0, count: 0 };
        cur.total += t.amount;
        cur.count++;
        cur.names.set(t.title.trim(), (cur.names.get(t.title.trim()) || 0) + 1);
        g.set(key, cur);
      }
      const total = rows.reduce((s, t) => s + t.amount, 0);
      return {
        total: round(total),
        merchants: [...g.values()]
          .sort((a, b) => b.total - a.total)
          .slice(0, limit)
          .map((m) => ({
            name: [...m.names.entries()].sort((a, b) => b[1] - a[1])[0][0],
            total: round(m.total),
            transactions: m.count,
            sharePercent: total ? Math.round((m.total / total) * 100) : 0,
          })),
      };
    }
    case "list_loans": {
      const today = israelNow().date;
      const docs = await DocumentModel.find({ workspaceId, category: "פיננסים" }).lean();
      return {
        loans: docs.filter(isLoanDoc).map((d) => {
          const st = loanStats(
            { amount: d.amount, loanStartDate: d.loanStartDate, loanEndDate: d.loanEndDate, loanMonthlyPayment: d.loanMonthlyPayment },
            today
          );
          return {
            title: d.title,
            originalAmount: d.amount,
            monthlyPayment: d.loanMonthlyPayment,
            startDate: d.loanStartDate,
            endDate: d.loanEndDate,
            annualInterestPercent: d.loanInterestRate,
            paidPayments: st?.paidPayments,
            remainingPayments: st?.remainingPayments,
            estimatedRemainingBalance: st?.remainingBalance,
          };
        }),
      };
    }
    case "list_insights": {
      const rows = await Insight.find({ workspaceId }).sort({ createdAt: -1 }).limit(clampInt(args.limit, 20, 1, 50)).select("title topic createdAt").lean();
      return { insights: rows.map((r) => ({ title: r.title, topic: r.topic, date: ymd(new Date(r.createdAt)) })) };
    }
    case "save_insight": {
      const title = str(args.title).trim().slice(0, 120);
      const body = str(args.body).trim().slice(0, 8000);
      const topic = ["הוצאות", "הכנסות", "כללי"].includes(str(args.topic)) ? str(args.topic) : "כללי";
      if (!title || !body) throw new Error("חסרים כותרת או תוכן לתובנה");
      const doc = await Insight.create({ workspaceId, title, body, topic });
      return { saved: true, id: String(doc._id), where: "עמוד 'תובנות' באפליקציה" };
    }
    default:
      throw new Error(`כלי לא מוכר: ${name}`);
  }
}

async function handleRpc(workspaceId: mongoose.Types.ObjectId, msg: Rpc): Promise<Json | null> {
  const id = msg.id ?? null;
  const reply = (result: unknown): Json => ({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string): Json => ({ jsonrpc: "2.0", id, error: { code, message } });
  const isNotification = msg.id === undefined || msg.id === null;

  switch (msg.method) {
    case "initialize": {
      const asked = str(msg.params?.protocolVersion);
      return reply({
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "family-docs", version: "1.0.0" },
        instructions:
          "כלים לקריאת הוצאות והכנסות של המשפחה ולשמירת תובנות בעמוד 'תובנות'. קרא נתונים עם הכלים לפני כל מסקנה, ושמור תובנה עם save_insight רק מבוססת על המספרים שקראת.",
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const name = str(msg.params?.name);
      const args = (msg.params?.arguments as Json) || {};
      try {
        const result = await callTool(workspaceId, name, args);
        return reply({ content: [{ type: "text", text: JSON.stringify(result) }] });
      } catch (e) {
        const message = e instanceof Error ? e.message : "שגיאה בהרצת הכלי";
        return reply({ content: [{ type: "text", text: message }], isError: true });
      }
    }
    default:
      if (isNotification) return null; // notifications/initialized וכו'
      return fail(-32601, `Method not found: ${msg.method}`);
  }
}

async function authenticate(token: string) {
  if (!token || token.length < 20) return null;
  await connectToDatabase();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const t = await McpToken.findOne({ tokenHash }).select("workspaceId lastUsedAt").lean();
  if (!t) return null;
  // מעדכן "שימוש אחרון" לכל היותר פעם בדקה
  if (!t.lastUsedAt || Date.now() - new Date(t.lastUsedAt).getTime() > 60_000) {
    await McpToken.updateOne({ _id: t._id }, { $set: { lastUsedAt: new Date() } });
  }
  return t.workspaceId as mongoose.Types.ObjectId;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const workspaceId = await authenticate(token);
  if (!workspaceId) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }

  if (Array.isArray(body)) {
    const results = (await Promise.all(body.map((m) => handleRpc(workspaceId, m as Rpc)))).filter((r): r is Json => r !== null);
    return results.length ? NextResponse.json(results) : new NextResponse(null, { status: 202 });
  }
  const result = await handleRpc(workspaceId, body as Rpc);
  return result ? NextResponse.json(result) : new NextResponse(null, { status: 202 });
}

// אין זרם SSE: לפי המפרט מחזירים 405
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
