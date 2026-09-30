import mongoose, { Schema, models, model } from "mongoose";
// ייבוא צד-אפקט: מבטיח שמודל "User" נרשם ב-mongoose לפני populate("createdBy"),
// גם כשהקובץ הזה נטען לבדו ב-bundle נפרד (serverless function) שלא ייבא את User.ts ישירות.
import "@/lib/models/User";
import "@/lib/models/Workspace";

export interface ICalendarEvent {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  title: string;
  date: string; // "YYYY-MM-DD"
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const CalendarEventSchema = new Schema<ICalendarEvent>({
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
  title: { type: String, required: true },
  date: { type: String, required: true },
  notes: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

CalendarEventSchema.index({ workspaceId: 1, date: 1 });

export default models.CalendarEvent || model<ICalendarEvent>("CalendarEvent", CalendarEventSchema);
