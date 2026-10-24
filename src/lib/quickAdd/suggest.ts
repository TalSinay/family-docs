import { DEFAULT_DICTIONARY } from "./dictionary";
import { normalizeWord } from "./parse";
import { Dictionary, Intent } from "./types";

export type Suggestion = {
  id: string;
  text: string; // הטקסט שימולא בשורת הכתיבה; "___" מסמן מקום להשלמה
  hint?: string;
  source: "template" | "history";
};

type Template = { id: string; intent: Intent; text: string; hint: string };

// מחסן התבניות. תבנית מוצעת כשהמשתמש מתחיל לכתוב מילת מפתח של הכוונה שלה.
const TEMPLATES: Template[] = [
  { id: "expense", intent: "expense", text: "שילמתי ___ על ___", hint: "הוצאה" },
  { id: "income", intent: "income", text: "קיבלתי ___ מ___", hint: "הכנסה" },
  { id: "monthly", intent: "reminder", text: "תזכיר לי כל 1 לחודש ___", hint: "תזכורת חודשית" },
  { id: "remind-date", intent: "reminder", text: "תזכיר לי מחר ___", hint: "תזכורת" },
  { id: "document", intent: "document", text: "מסמך חדש ___", hint: "מסמך חדש" },
  { id: "task", intent: "task", text: "צריך ___", hint: "משימה" },
  { id: "shopping", intent: "shopping", text: "תוסיף לקניות ___", hint: "קניות" },
  { id: "q-when", intent: "question", text: "מתי מתחדש ___", hint: "שאלה" },
  { id: "q-howmuch", intent: "question", text: "כמה שילמנו על ___", hint: "שאלה" },
];

const STARTERS = ["expense", "monthly", "task", "shopping", "q-when"];
const MAX = 5;

export function suggest(input: string, history: string[], dict: Dictionary = DEFAULT_DICTIONARY): Suggestion[] {
  const text = input.trim();
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const push = (s: Suggestion) => {
    if (!seen.has(s.text) && out.length < MAX) {
      seen.add(s.text);
      out.push(s);
    }
  };

  if (!text) {
    STARTERS.forEach((id) => {
      const t = TEMPLATES.find((x) => x.id === id)!;
      push({ id: t.id, text: t.text, hint: t.hint, source: "template" });
    });
    return out;
  }

  const lastWord = normalizeWord(text.split(/\s+/).pop() || "");
  const full = normalizeWord(text);

  // היסטוריה: דברים שהמשתמש כבר כתב והתחילו כמו הטקסט
  history
    .filter((h) => normalizeWord(h).startsWith(full) && normalizeWord(h) !== full)
    .slice(0, 3)
    .forEach((h) => push({ id: `h-${h}`, text: h, hint: "מההיסטוריה שלך", source: "history" }));

  // תבניות: לפי תחילת מילת מפתח או תחילת התבנית
  const matchedIntents = new Set<Intent>();
  (Object.keys(dict.intents) as Intent[]).forEach((intent) => {
    if (dict.intents[intent].some((w) => lastWord.length >= 2 && normalizeWord(w).startsWith(lastWord))) {
      matchedIntents.add(intent);
    }
  });
  TEMPLATES.forEach((t) => {
    if (matchedIntents.has(t.intent) || normalizeWord(t.text).startsWith(full)) {
      push({ id: t.id, text: t.text, hint: t.hint, source: "template" });
    }
  });

  return out;
}

const HISTORY_KEY = "familyDocs.quickAdd.history";

export function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function rememberInput(text: string): void {
  try {
    const next = [text, ...loadHistory().filter((h) => h !== text)].slice(0, 30);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* אחסון לא זמין (מצב פרטי וכו') - לא קריטי */
  }
}
