import mongoose, { Schema, models, model } from "mongoose";
import "@/lib/models/User";

// תזכורת חוזרת מדי חודש (לא קשורה למסמך/משימה ספציפיים) - למשל "להעלות תלוש
// שכר" בכל 1 לחודש. נשלחת כ-push בכל יום שבו day-of-month הנוכחי תואם,
// ראו src/app/api/cron/daily-reminders/route.ts.
export interface IMonthlyReminder {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  title: string;
  dayOfMonth: number; // 1-28 (נמנעים מ-29/30/31 כדי שתמיד יחול גם בפברואר)
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const MonthlyReminderSchema = new Schema<IMonthlyReminder>({
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
  title: { type: String, required: true },
  dayOfMonth: { type: Number, required: true, min: 1, max: 28 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

MonthlyReminderSchema.index({ workspaceId: 1 });

export default models.MonthlyReminder ||
  model<IMonthlyReminder>("MonthlyReminder", MonthlyReminderSchema);
