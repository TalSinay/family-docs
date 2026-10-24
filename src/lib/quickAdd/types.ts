// הוספה מהירה בכתיבה חופשית - פענוח מקומי (חוקים ומילון), בלי AI חיצוני.

export type Intent = "expense" | "income" | "task" | "reminder" | "shopping" | "question";

export type HighlightKind = "int" | "amt" | "cat" | "date" | "rec";
export type Highlight = { start: number; end: number; kind: HighlightKind };

// מה האפליקציה תעשה עם הטקסט
export type ParseKind = "expense" | "income" | "task" | "monthly" | "shopping" | "question" | "unknown";

export type ParseResult = {
  kind: ParseKind;
  confidence: "high" | "medium" | "low";
  highlights: Highlight[];
  title: string;
  amount?: number;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  subcategory?: string;
  dayOfMonth?: number; // לתזכורת חודשית
  items?: string[]; // לקניות
  searchQuery?: string; // לשאלות
  questionType?: "when" | "howMuch" | "other";
  guessed?: boolean; // אין מילת כוונה מוכרת, הסוג נוחש לפי סכום/תאריך
  unknownWords?: string[]; // מילים שלא זוהו, מועמדות ללימוד במילון
  notes: string[]; // הערות קצרות למשתמש, למשל "תאריך לא זוהה"
};

export type CategoryWord = { word: string; subcategory: string };

export type Dictionary = {
  intents: Record<Intent, string[]>;
  categoryWords: CategoryWord[];
};
