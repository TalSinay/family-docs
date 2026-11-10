import { Schema, models, model } from "mongoose";

// הגדרות גלובליות של האפליקציה (מסמך יחיד, key="global"), בניהול ה-admin.
export interface IAppSettings {
  key: string;
  notificationTime: string; // "HH:MM" שעון ישראל - שעת ברירת המחדל לשליחת התראות
  lastCronRunAt?: string; // ISO - מתי ה-cron פנה לשרת בפעם האחרונה (אבחון התראות)
  lastCronSent?: number; // כמה התראות נשלחו בריצה האחרונה
  lastDailyRunDate?: string; // "YYYY-MM-DD" - מונע שליחה כפולה של ההתראות היומיות
}

const AppSettingsSchema = new Schema<IAppSettings>({
  key: { type: String, required: true, unique: true },
  notificationTime: { type: String, default: "09:00" },
  lastCronRunAt: { type: String },
  lastCronSent: { type: Number },
  lastDailyRunDate: { type: String },
});

export default models.AppSettings || model<IAppSettings>("AppSettings", AppSettingsSchema);
