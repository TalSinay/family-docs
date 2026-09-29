import mongoose, { Schema, models, model } from "mongoose";

export interface ICalendarEvent {
  _id: mongoose.Types.ObjectId;
  title: string;
  date: string; // "YYYY-MM-DD"
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const CalendarEventSchema = new Schema<ICalendarEvent>({
  title: { type: String, required: true },
  date: { type: String, required: true },
  notes: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

CalendarEventSchema.index({ date: 1 });

export default models.CalendarEvent || model<ICalendarEvent>("CalendarEvent", CalendarEventSchema);
