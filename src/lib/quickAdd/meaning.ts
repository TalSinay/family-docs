import { MAIN_CATEGORIES } from "@/lib/categories";
import { normalizeWord } from "./parse";
import { Dictionary, Intent } from "./types";

// מפרש מה שהמשתמש הקליד ידנית כ"משמעות" של מילה: כוונה (הוצאה, תזכורת...) או קטגוריה.
// למשל "הוצאה" ← expense, "ביטוחים" ← קטגוריה, "פוליסה" ← קטגוריית ביטוחים לפי המילון.
const INTENT_NAMES: Record<string, Intent> = {
  הוצאה: "expense", הוצאות: "expense", תשלום: "expense", קנייה: "expense", קניה: "expense", רכישה: "expense",
  הכנסה: "income", הכנסות: "income", קבלת: "income",
  "מסמך חדש": "document", "קובץ חדש": "document", מסמך: "document", קובץ: "document", תיוק: "document",
  משימה: "task", משימות: "task",
  תזכורת: "reminder", התראה: "reminder",
  קניות: "shopping", "רשימת קניות": "shopping",
  שאלה: "question", חיפוש: "question",
};

export type Meaning = { intent?: Intent; category?: string };

export function interpretMeaning(typed: string, dict: Dictionary): Meaning | null {
  const t = normalizeWord(typed).replace(/\s+/g, " ").trim();
  if (!t) return null;

  const cat = (MAIN_CATEGORIES as readonly string[]).find((c) => normalizeWord(c) === t);
  if (cat) return { category: cat };
  if (INTENT_NAMES[t]) return { intent: INTENT_NAMES[t] };

  // מילה שכבר קיימת במילון: מעבירים את משמעותה
  const docWord = dict.docCategoryWords.find((w) => normalizeWord(w.word) === t);
  if (docWord) return { category: docWord.category };
  for (const intent of Object.keys(dict.intents) as Intent[]) {
    if (dict.intents[intent].some((w) => normalizeWord(w) === t)) return { intent };
  }
  return null;
}
