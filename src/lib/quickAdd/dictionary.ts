import { CategoryWord, Dictionary, Intent } from "./types";

// מילון ברירת המחדל. מילים/ביטויים ללא ניקוד. אפשר להוסיף כאן בקלות; מילים שהמשפחה
// מוסיפה בזמן שימוש נטענות ממסד הנתונים ומתמזגות עליו (mergeDictionary).
export const DEFAULT_DICTIONARY: Dictionary = {
  intents: {
    expense: ["שילמתי", "שילמנו", "שילמה", "קניתי", "קנינו", "עלה", "עלתה", "הוצאתי", "הוצאנו", "חויבתי", "חיוב", "הוצאה", "שולם", "שלמתי"],
    income: ["קיבלתי", "קיבלנו", "הכנסה", "משכורת", "הופקד", "נכנס", "נכנסו", "הכנסתי"],
    reminder: ["תזכיר", "תזכירי", "הזכר", "הזכירי", "תזכורת", "תתריע", "להזכיר"],
    task: ["משימה", "צריך", "צריכה", "חייב", "חייבת", "חייבים", "לא לשכוח", "לזכור", "צריכים"],
    shopping: ["לקניות", "קניות", "לרשימה", "לקנות", "לסופר"],
    question: ["מתי", "כמה", "איפה", "האם", "איזה", "איזו", "מה"],
  },
  categoryWords: [
    ...words("רכב", ["דלק", "בנזין", "טסט", "מוסך", "חניה", "כביש 6", "תיקון רכב", "רישיון רכב"]),
    ...words("דיור", ["שכירות", "שכר דירה", "ארנונה", "ועד בית", "משכנתא"]),
    ...words("חשבונות", ["חשמל", "מים", "גז", "אינטרנט", "סלולר", "טלפון", "כבלים"]),
    ...words("אוכל", ["סופר", "מכולת", "מסעדה", "קפה", "ארומה", "וולט", "פיצה", "שוק", "ארוחה", "אוכל"]),
    ...words("בריאות", ["רופא", "תרופות", "סופר פארם", "קופת חולים", "רופא שיניים", "שיניים", "משקפיים", "בדיקה"]),
    ...words("ילדים", ["גן", "בית ספר", "חוג", "חוגים", "טיטולים", "בייביסיטר"]),
    ...words("בילויים", ["קולנוע", "בילוי", "נטפליקס", "ספוטיפיי", "חופשה", "מלון", "טיסה"]),
    ...words("ביגוד", ["בגדים", "נעליים", "בגד"]),
    ...words("שכר", ["משכורת", "שכר", "בונוס", "קצבה", "החזר מס", "החזר"]),
  ],
};

function words(subcategory: string, list: string[]): CategoryWord[] {
  return list.map((word) => ({ word, subcategory }));
}

export type CustomDictionaryEntry = { word: string; intent?: Intent; subcategory?: string };

// מיזוג מילים מותאמות (מהמסד) על מילון ברירת המחדל
export function mergeDictionary(base: Dictionary, custom: CustomDictionaryEntry[]): Dictionary {
  const intents = { ...base.intents } as Dictionary["intents"];
  (Object.keys(intents) as Intent[]).forEach((k) => (intents[k] = [...intents[k]]));
  const categoryWords = [...base.categoryWords];
  for (const c of custom) {
    const w = c.word.trim();
    if (!w) continue;
    if (c.intent) intents[c.intent].push(w);
    if (c.subcategory) categoryWords.push({ word: w, subcategory: c.subcategory });
  }
  return { intents, categoryWords };
}
