// זמן ישראל (Asia/Jerusalem) - השרת וה-cron רצים ב-UTC, אבל "היום" ו"השעה" של
// התראות נקבעים לפי שעון ישראל.

export const DEFAULT_NOTIFICATION_TIME = "09:00";
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(s: unknown): s is string {
  return typeof s === "string" && TIME_RE.test(s);
}

export function israelNow(): { date: string; time: string } {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(now);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  // en-GB יכול להחזיר "24:05" בחצות בחלק מהסביבות
  return { date, time: time.startsWith("24") ? `00${time.slice(2)}` : time };
}
