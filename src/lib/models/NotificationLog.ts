import mongoose, { Schema, models, model } from "mongoose";

// יומן התראות שנשלחו בפועל (לתצוגה בעמוד "התראות"). נמחק אוטומטית אחרי 60 יום.
export interface INotificationLog {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  kind: "monthly" | "task" | "document";
  title: string; // כותרת ההתראה כפי שנשלחה (לדוגמה "משימה להיום")
  body: string; // תוכן ההתראה
  url?: string;
  sentAt: Date;
}

const NotificationLogSchema = new Schema<INotificationLog>({
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
  kind: { type: String, enum: ["monthly", "task", "document"], required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  url: { type: String },
  sentAt: { type: Date, default: Date.now, expires: 60 * 24 * 60 * 60 },
});

NotificationLogSchema.index({ workspaceId: 1, sentAt: -1 });

export default models.NotificationLog ||
  model<INotificationLog>("NotificationLog", NotificationLogSchema);
