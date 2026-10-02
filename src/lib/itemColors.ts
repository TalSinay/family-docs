// פלטת צבעים משותפת לבחירה בעת יצירת אירוע ביומן או משימה - נשמר כ-hex על
// הרשומה עצמה (CalendarEvent.color / Task.color). ברירת המחדל כשלא נבחר צבע
// היא הצבע הקבוע הקודם (טיל לאירועים, סגול למשימות) - ראו DEFAULT_EVENT_COLOR/
// DEFAULT_TASK_COLOR למטה, כדי שפריטים ישנים בלי color ימשיכו להיראות אותו דבר.
export const ITEM_COLORS: { name: string; value: string }[] = [
  { name: "טיל", value: "#0d9488" },
  { name: "סגול", value: "#7c3aed" },
  { name: "אדום", value: "#dc2626" },
  { name: "כתום", value: "#ea580c" },
  { name: "ירוק", value: "#16a34a" },
  { name: "כחול", value: "#2563eb" },
  { name: "ורוד", value: "#db2777" },
  { name: "אפור", value: "#475569" },
];

export const DEFAULT_EVENT_COLOR = "#0d9488"; // teal-600, כמו שהיה קבוע עד כה
export const DEFAULT_TASK_COLOR = "#7c3aed"; // violet-600, כמו שהיה קבוע עד כה
