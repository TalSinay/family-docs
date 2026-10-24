import { DEFAULT_DICTIONARY, DOC_CATEGORY_WORDS } from "./dictionary";
import { Dictionary, Highlight, HighlightKind, Intent, ParseResult } from "./types";

// ---------- עזרי טקסט ----------

type Token = { raw: string; norm: string; start: number; end: number };

const NIKUD = /[֑-ׇ]/g;
const EDGE_PUNCT = /^[\s,.;:!?()"'״׳]+|[\s,.;:!?()"'״׳]+$/g;
const PREFIXES = "והבלמשכ";

export function normalizeWord(s: string): string {
  return s.replace(NIKUD, "").replace(/["'״׳]/g, "").toLowerCase();
}

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const lead = raw.length - raw.replace(/^[\s,.;:!?()"'״׳]+/, "").length;
    const trimmed = raw.replace(EDGE_PUNCT, "");
    if (!trimmed) continue;
    out.push({ raw: trimmed, norm: normalizeWord(trimmed), start: m.index + lead, end: m.index + lead + trimmed.length });
  }
  return out;
}

// צורות אפשריות של מילה אחרי הסרת קידומות עבריות (ב, ל, ה, ו, ש, מ, כ)
function variants(norm: string): string[] {
  const set = new Set<string>([norm]);
  const base = norm.replace(/^-/, "");
  set.add(base);
  if (base.length > 2 && PREFIXES.includes(base[0])) {
    set.add(base.slice(1));
    if (base.length > 3 && PREFIXES.includes(base[1])) set.add(base.slice(2));
  }
  return [...set];
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

// ---------- תאריכים ----------

const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
function addMonths(s: string, n: number): string {
  const d = parseYmd(s);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return ymd(d);
}

function monthFromWord(norm: string): number | null {
  for (const v of variants(norm)) {
    const exact = MONTHS.indexOf(v);
    if (exact >= 0) return exact;
    // תיקון שגיאות כתיב קטנות ("ברנואר" -> ינואר), רק למילים ארוכות
    if (v.length >= 5) {
      const idx = MONTHS.findIndex((mo) => mo.length >= 5 && levenshtein(v, mo) <= 1);
      if (idx >= 0) return idx;
    }
  }
  return null;
}

function weekdayFromWord(norm: string): number | null {
  for (const v of variants(norm)) {
    const idx = WEEKDAYS.indexOf(v);
    if (idx >= 0) return idx;
  }
  return null;
}

// ---------- מספרים ----------

function numberValue(norm: string): number | null {
  const t = norm.replace(/^[בלכמשו]-?/, (m) => (/\d/.test(norm.slice(m.length)) ? "" : m)).replace(/^-/, "");
  const s = t.replace(/[₪]/g, "");
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ""));
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  return null;
}

const NUMBER_WORDS: Record<string, number> = { מאה: 100, מאתיים: 200, אלף: 1000, אלפיים: 2000 };
const CURRENCY = new Set(["₪", "שח", "שקל", "שקלים", "שקלים", "ש״ח"]);

const STOPWORDS = new Set(["על", "את", "של", "לי", "אני", "גם", "עוד", "עם", "כדי", "זה", "זו", "ה", "ו", "ב", "ל", "מ", "ש", "אל", "מן"]);

// ---------- פענוח ----------

const NOUN_TRIGGERS = new Set(["משכורת"]);

const PRIORITY: Intent[] = ["shopping", "reminder", "expense", "income", "document", "task", "question"];

export function parse(
  text: string,
  today: string,
  dict: Dictionary = DEFAULT_DICTIONARY,
  forceIntent?: Intent
): ParseResult {
  const tokens = tokenize(text);
  const claims = new Map<number, HighlightKind>();
  const claim = (i: number, kind: HighlightKind) => claims.set(i, kind);
  const free = (i: number) => !claims.has(i);
  const notes: string[] = [];

  // --- חזרתיות חודשית: "כל 1 לחודש", "כל חודש ב-5" ---
  let dayOfMonth: number | undefined;
  for (let i = 0; i < tokens.length; i++) {
    if (!variants(tokens[i].norm).includes("כל")) continue;
    const a = tokens[i + 1];
    const b = tokens[i + 2];
    if (a && b && numberValue(a.norm) !== null && variants(b.norm).includes("חודש")) {
      dayOfMonth = numberValue(a.norm)!;
      [i, i + 1, i + 2].forEach((k) => claim(k, "rec"));
      break;
    }
    if (a && b && variants(a.norm).includes("חודש") && numberValue(b.norm) !== null) {
      dayOfMonth = numberValue(b.norm)!;
      [i, i + 1, i + 2].forEach((k) => claim(k, "rec"));
      break;
    }
  }

  // --- כוונה ---
  const scores = new Map<Intent, { score: number; idxs: number[] }>();
  const bump = (intent: Intent, w: number, idxs: number[]) => {
    const cur = scores.get(intent) ?? { score: 0, idxs: [] };
    cur.score += w;
    cur.idxs.push(...idxs);
    scores.set(intent, cur);
  };
  const phrases: { intent: Intent; words: string[]; weight: number }[] = [];
  (Object.keys(dict.intents) as Intent[]).forEach((intent) => {
    for (const phrase of dict.intents[intent]) {
      const ws = normalizeWord(phrase).split(/\s+/).filter(Boolean);
      const weight = intent === "question" ? (ws[0] === "מה" ? 1 : 2) : ["shopping", "reminder", "expense", "income", "document"].includes(intent) ? 3 : 2;
      phrases.push({ intent, words: ws, weight });
    }
  });
  phrases.sort((a, b) => b.words.length - a.words.length);
  const usedByIntent = new Set<number>();
  for (let i = 0; i < tokens.length; i++) {
    if (!free(i) || usedByIntent.has(i)) continue;
    for (const p of phrases) {
      const span = p.words.length;
      if (i + span > tokens.length) continue;
      const ok = p.words.every((w, k) => free(i + k) && variants(tokens[i + k].norm).includes(w));
      if (ok) {
        const idxs = Array.from({ length: span }, (_, k) => i + k);
        bump(p.intent, p.weight, idxs);
        idxs.forEach((k) => usedByIntent.add(k));
        break;
      }
    }
  }
  if (/[?]\s*$/.test(text.trim())) bump("question", 2, []);
  if (dayOfMonth !== undefined) bump("reminder", 2, []);

  let intent: Intent | null = forceIntent ?? null;
  if (!intent) {
    let best = 0;
    for (const p of PRIORITY) {
      const s = scores.get(p);
      if (s && s.score > best) {
        best = s.score;
        intent = p;
      }
    }
  }
  if (intent) {
    // "תזכיר לי": גם "לי" שייך לביטוי
    scores.get(intent)?.idxs.forEach((i) => {
      // שמות עצם כמו "משכורת" מעידים על הכוונה אבל נשארים חלק מהכותרת
      if (NOUN_TRIGGERS.has(tokens[i].norm)) return;
      claim(i, "int");
      if (intent === "reminder" && tokens[i + 1] && tokens[i + 1].norm === "לי" && free(i + 1)) claim(i + 1, "int");
    });
  }

  const isMoney = intent === "expense" || intent === "income";
  const isFuture = !isMoney;

  // --- תאריך ---
  let date: string | undefined;
  let monthOnly = false;
  const resolveDM = (d: number | null, m: number): string => {
    const year = parseYmd(today).getUTCFullYear();
    const day = d ?? 1;
    const make = (y: number) => `${y}-${pad(m + 1)}-${pad(Math.min(day, new Date(Date.UTC(y, m + 1, 0)).getUTCDate()))}`;
    let cand = make(year);
    if (isFuture && cand < today) cand = make(year + 1);
    if (!isFuture && cand > addDays(today, 7)) cand = make(year - 1);
    return cand;
  };

  for (let i = 0; i < tokens.length && !date; i++) {
    if (!free(i)) continue;
    const vs = variants(tokens[i].norm);
    const next = tokens[i + 1];
    if (vs.includes("היום")) { date = today; claim(i, "date"); }
    else if (vs.includes("אתמול")) { date = addDays(today, -1); claim(i, "date"); }
    else if (vs.includes("שלשום")) { date = addDays(today, -2); claim(i, "date"); }
    else if (vs.includes("מחר")) { date = addDays(today, 1); claim(i, "date"); }
    else if (vs.includes("מחרתיים")) { date = addDays(today, 2); claim(i, "date"); }
    else if (vs.includes("בעוד") || tokens[i].norm === "בעוד") {
      // בעוד N ימים/שבועות/חודשים, בעוד שבוע, בעוד יומיים
      const n = next ? numberValue(next.norm) : null;
      const unitTok = n !== null ? tokens[i + 2] : next;
      const unit = unitTok ? variants(unitTok.norm) : [];
      const count = n ?? 1;
      let res: string | undefined;
      if (unit.some((u) => u === "יומיים")) res = addDays(today, 2);
      else if (unit.some((u) => u === "שבועיים")) res = addDays(today, 14);
      else if (unit.some((u) => u === "יום" || u === "ימים")) res = addDays(today, count);
      else if (unit.some((u) => u === "שבוע" || u === "שבועות")) res = addDays(today, 7 * count);
      else if (unit.some((u) => u === "חודש" || u === "חודשים")) res = addMonths(today, count);
      if (res && unitTok) {
        date = res;
        claim(i, "date");
        if (n !== null) claim(i + 1, "date");
        claim(n !== null ? i + 2 : i + 1, "date");
      }
    } else if (vs.includes("יום") && next && weekdayFromWord(next.norm) !== null) {
      const target = weekdayFromWord(next.norm)!;
      const cur = parseYmd(today).getUTCDay();
      const diff = isFuture ? ((target - cur + 6) % 7) + 1 : -(((cur - target + 6) % 7) + 1);
      date = addDays(today, diff);
      claim(i, "date");
      claim(i + 1, "date");
    } else {
      // d.m / d/m / d.m.yy
      const dm = /^[בלמ]?-?(\d{1,2})([./])(\d{1,2})(?:[./](\d{2,4}))?$/.exec(tokens[i].norm);
      if (dm) {
        const d = Number(dm[1]);
        const mo = Number(dm[3]);
        const prev = tokens[i - 1] ? variants(tokens[i - 1].norm) : [];
        const dateish = dm[2] === "/" || !!dm[4] || /^[בלמ]-?/.test(tokens[i].norm) || prev.includes("תאריך") || prev.includes("עד");
        if (dateish && d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
          let y = parseYmd(today).getUTCFullYear();
          if (dm[4]) y = dm[4].length === 2 ? 2000 + Number(dm[4]) : Number(dm[4]);
          let cand = `${y}-${pad(mo)}-${pad(d)}`;
          if (!dm[4] && isFuture && cand < today) cand = `${y + 1}-${pad(mo)}-${pad(d)}`;
          date = cand;
          claim(i, "date");
          if (prev.includes("תאריך") || prev.includes("עד")) claim(i - 1, "date");
        }
      } else {
        // "5 בדצמבר", "בדצמבר", "ברנואר"
        const dn = numberValue(tokens[i].norm);
        const mNext = next ? monthFromWord(next.norm) : null;
        if (dn !== null && dn >= 1 && dn <= 31 && mNext !== null) {
          date = resolveDM(dn, mNext);
          claim(i, "date");
          claim(i + 1, "date");
        } else if (dn === null && monthFromWord(tokens[i].norm) !== null && !/\d/.test(tokens[i].norm)) {
          // חודש בלבד: ראשון בחודש
          const m = monthFromWord(tokens[i].norm)!;
          date = resolveDM(null, m);
          monthOnly = true;
          claim(i, "date");
        }
      }
    }
  }

  // --- שעה ---
  let time: string | undefined;
  for (let i = 0; i < tokens.length; i++) {
    if (!free(i)) continue;
    const t = /^[בלמ]?-?(\d{1,2}):(\d{2})$/.exec(tokens[i].norm);
    if (t && Number(t[1]) < 24 && Number(t[2]) < 60) {
      time = `${pad(Number(t[1]))}:${t[2]}`;
      claim(i, "date");
      break;
    }
    if (variants(tokens[i].norm).includes("שעה") && tokens[i + 1] && free(i + 1)) {
      const h = numberValue(tokens[i + 1].norm);
      if (h !== null && h >= 0 && h < 24) {
        time = `${pad(h)}:00`;
        claim(i, "date");
        claim(i + 1, "date");
        break;
      }
    }
  }

  // --- סכום ---
  let amount: number | undefined;
  for (let i = 0; i < tokens.length; i++) {
    if (!free(i)) continue;
    let val = numberValue(tokens[i].norm);
    let span = 1;
    if (val === null && NUMBER_WORDS[tokens[i].norm] !== undefined && intent !== "task") {
      val = NUMBER_WORDS[tokens[i].norm];
    } else if (val !== null && tokens[i + 1] && NUMBER_WORDS[tokens[i + 1].norm] === 1000 && free(i + 1)) {
      val *= 1000;
      span = 2;
    }
    if (val === null) continue;
    // מספר שמופיע אחרי "ל"/"ב" ללא סימון כסף, בהקשר לא כספי, לא נחשב סכום
    if ((intent === "task" || intent === "reminder" || intent === "shopping") && !tokensHaveCurrency(tokens, i, span)) continue;
    amount = val;
    for (let k = 0; k < span; k++) claim(i + k, "amt");
    const after = tokens[i + span];
    if (after && CURRENCY.has(after.norm) && free(i + span)) claim(i + span, "amt");
    break;
  }
  // סימן ₪ בנפרד או צמוד
  tokens.forEach((t, i) => {
    if (free(i) && (CURRENCY.has(t.norm) || t.norm === "₪")) claim(i, "amt");
  });

  // --- קטגוריה ---
  let subcategory: string | undefined;
  const catPhrases = dict.categoryWords
    .map((c) => ({ ws: normalizeWord(c.word).split(/\s+/).filter(Boolean), sub: c.subcategory }))
    .sort((a, b) => b.ws.length - a.ws.length);
  if (isMoney || intent === null) {
    outer: for (let i = 0; i < tokens.length; i++) {
      if (!free(i)) continue;
      for (const c of catPhrases) {
        if (i + c.ws.length > tokens.length) continue;
        if (c.ws.every((w, k) => free(i + k) && variants(tokens[i + k].norm).includes(w))) {
          subcategory = c.sub;
          for (let k = 0; k < c.ws.length; k++) claim(i + k, "cat");
          break outer;
        }
      }
    }
  }

  // קטגוריית מסמך ("זיכוי" ← זיכויים) בכוונת "מסמך חדש"
  let docCategory: string | undefined;
  if (intent === "document") {
    const docPhrases = DOC_CATEGORY_WORDS.map((c) => ({ ws: normalizeWord(c.word).split(/\s+/), cat: c.category })).sort(
      (a, b) => b.ws.length - a.ws.length
    );
    outerDoc: for (let i = 0; i < tokens.length; i++) {
      if (!free(i)) continue;
      for (const c of docPhrases) {
        if (i + c.ws.length > tokens.length) continue;
        if (c.ws.every((w, k) => free(i + k) && variants(tokens[i + k].norm).includes(w))) {
          docCategory = c.cat;
          for (let k = 0; k < c.ws.length; k++) claim(i + k, "cat");
          break outerDoc;
        }
      }
    }
  }

  // אין מילת כוונה מוכרת: מנחשים לפי מה שזוהה, ומסמנים כניחוש כדי שהמשתמש יוכל ללמד את המילון
  let guessed = false;
  if (intent === null && amount !== undefined) {
    intent = "expense";
    guessed = true;
  } else if (intent === null && date) {
    intent = "task";
    guessed = true;
  }

  // --- שלד התוצאה ---
  const highlights = buildHighlights(tokens, claims);
  const isStop = (n: string) => STOPWORDS.has(n);
  const allIntentWords = new Set(
    (Object.values(dict.intents) as string[][]).flat().flatMap((p) => normalizeWord(p).split(/\s+/))
  );
  const contentIdx = tokens
    .map((_, i) => i)
    .filter((i) => {
      const c = claims.get(i);
      return c === undefined || c === "cat";
    });
  const base = {
    highlights,
    notes,
    date,
    time,
    guessed,
    unknownWords: unknownWordsOf(tokens, contentIdx, claims),
    leadPhrase: leadPhraseOf(tokens, claims),
  };

  if (intent === "question") {
    const q = tokens
      .filter((_, i) => contentIdx.includes(i))
      .map((t) => t.raw)
      .filter((w) => !isStop(normalizeWord(w)) && !allIntentWords.has(normalizeWord(w)));
    const first = tokens.find((t) => dict.intents.question.map(normalizeWord).includes(normalizeWord(t.raw)))?.norm;
    const questionType = first === "מתי" ? "when" : first === "כמה" ? "howMuch" : "other";
    return { ...base, kind: "question", confidence: q.length ? "high" : "low", title: text.trim(), searchQuery: q.join(" "), questionType };
  }

  if (intent === "shopping") {
    const items = splitItems(tokens, contentIdx, text);
    return { ...base, kind: "shopping", confidence: items.length ? "high" : "low", title: "קניות", items, date: undefined };
  }

  const titleWords = contentIdx.map((i) => tokens[i]).filter((t) => !(isMoney && isStop(t.norm)));
  const trimLead = (arr: Token[]) => {
    // בכותרת מורידים מילות קישור בקצוות ("את" בהתחלה, "של"/"על" בסוף)
    const a = [...arr];
    while (a.length && ["את", "ש", "ל", "ו"].includes(a[0].norm)) a.shift();
    while (a.length && ["של", "על", "את", "ל", "ב", "עם"].includes(a[a.length - 1].norm)) a.pop();
    return a;
  };
  const title = (isMoney ? titleWords : trimLead(titleWords)).map((t) => t.raw).join(" ").trim();

  if (intent === "document") {
    const docTitle = trimLead(titleWords).map((t) => t.raw).join(" ").trim();
    return {
      ...base,
      kind: "document",
      confidence: !docTitle ? "low" : guessed ? "medium" : "high",
      title: docTitle,
      amount,
      docCategory: docCategory ?? "כללי",
    };
  }

  if (intent === "expense" || intent === "income") {
    const conf = amount !== undefined ? (guessed ? "medium" : title || subcategory ? "high" : "medium") : "low";
    if (amount === undefined) notes.push("לא זוהה סכום");
    return {
      ...base,
      kind: intent,
      confidence: conf,
      title: title || subcategory || (intent === "expense" ? "הוצאה" : "הכנסה"),
      amount,
      subcategory,
      date: date ?? today,
      ...(date ? {} : { notes: [...notes, "תאריך לא זוהה, נקבע להיום"] }),
    };
  }

  if (intent === "reminder" && dayOfMonth !== undefined) {
    const valid = dayOfMonth >= 1 && dayOfMonth <= 28;
    if (!valid) notes.push("יום בחודש צריך להיות בין 1 ל-28");
    return {
      ...base,
      kind: "monthly",
      confidence: !title ? "low" : valid ? "high" : "medium",
      title,
      dayOfMonth,
      date: undefined,
    };
  }

  if (intent === "reminder" || intent === "task") {
    const conf = !title ? "low" : guessed ? "medium" : date ? "high" : "medium";
    if (!date) notes.push("תאריך לא זוהה, נקבע להיום");
    return { ...base, kind: "task", confidence: conf, title, date: date ?? today, ...(monthOnly ? { notes: [...notes, "זוהה חודש בלבד"] } : {}) };
  }

  return { ...base, kind: "unknown", confidence: "low", title: text.trim(), amount, subcategory };
}

// מילים שלא הובנו (לא כוונה/סכום/תאריך/קטגוריה) - מועמדות ללימוד במילון
function unknownWordsOf(tokens: Token[], contentIdx: number[], claims: Map<number, HighlightKind>): string[] {
  return contentIdx
    .filter((i) => claims.get(i) === undefined && !STOPWORDS.has(tokens[i].norm))
    .map((i) => tokens[i].raw);
}

// תחילת המשפט שלא זוהתה (עד שתי מילים) - מה שכדאי ללמד את המילון, למשל "יש לי"
function leadPhraseOf(tokens: Token[], claims: Map<number, HighlightKind>): string | undefined {
  const out: string[] = [];
  for (let i = 0; i < Math.min(2, tokens.length); i++) {
    if (claims.get(i) !== undefined) break;
    out.push(tokens[i].raw);
  }
  return out.length ? out.join(" ") : undefined;
}

function tokensHaveCurrency(tokens: Token[], i: number, span: number): boolean {
  const after = tokens[i + span];
  return /₪/.test(tokens[i].raw) || (!!after && CURRENCY.has(after.norm));
}

function buildHighlights(tokens: Token[], claims: Map<number, HighlightKind>): Highlight[] {
  const out: Highlight[] = [];
  tokens.forEach((t, i) => {
    const kind = claims.get(i);
    if (!kind) return;
    const last = out[out.length - 1];
    const prevTok = tokens[i - 1];
    if (last && last.kind === kind && prevTok && claims.get(i - 1) === kind) last.end = t.end;
    else out.push({ start: t.start, end: t.end, kind });
  });
  return out;
}

// פירוק פריטי קניות: לפי פסיקים / "ו", אחרת כל מילה בנפרד (עד שתי מילים = פריט אחד)
function splitItems(tokens: Token[], contentIdx: number[], text: string): string[] {
  const toks = contentIdx.map((i) => tokens[i]).filter((t) => !STOPWORDS.has(t.norm) && t.norm !== "תוסיף" && t.norm !== "הוסף" && t.norm !== "תוסיפי" && t.norm !== "תביא" && t.norm !== "לקנות");
  if (!toks.length) return [];
  const hasSeparators = toks.some((t, i) => i < toks.length - 1 && /[,،]/.test(text.slice(t.end, t.end + 1))) || toks.some((t, i) => i > 0 && t.norm.length > 2 && t.norm.startsWith("ו"));
  if (!hasSeparators) {
    return toks.length <= 2 ? [toks.map((t) => t.raw).join(" ")] : toks.map((t) => t.raw);
  }
  const items: string[] = [];
  let cur: string[] = [];
  toks.forEach((t, i) => {
    let w = t.raw;
    if (i > 0 && w.startsWith("ו") && w.length > 2) {
      if (cur.length) items.push(cur.join(" "));
      cur = [];
      w = w.slice(1);
    }
    cur.push(w);
    if (/[,،]/.test(text.slice(t.end, t.end + 1))) {
      items.push(cur.join(" "));
      cur = [];
    }
  });
  if (cur.length) items.push(cur.join(" "));
  return items;
}
