import mongoose, { Schema, models, model } from "mongoose";
// ייבוא צד-אפקט: מבטיח שמודל "User" נרשם ב-mongoose לפני populate("createdBy"),
// גם כשהקובץ הזה נטען לבדו ב-bundle נפרד (serverless function) שלא ייבא את User.ts ישירות.
import "@/lib/models/User";
import "@/lib/models/Workspace";

export interface ITask {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  title: string;
  dueDate?: string; // "YYYY-MM-DD", אופציונלי
  isDone: boolean;
  color?: string; // hex, ראו src/lib/itemColors.ts - ריק = הצבע הקבוע הישן (סגול)
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const TaskSchema = new Schema<ITask>({
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
  title: { type: String, required: true },
  dueDate: { type: String },
  isDone: { type: Boolean, default: false },
  color: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

TaskSchema.index({ workspaceId: 1, isDone: 1, dueDate: 1 });

export default models.Task || model<ITask>("Task", TaskSchema);
