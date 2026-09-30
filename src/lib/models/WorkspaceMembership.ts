import mongoose, { Schema, models, model } from "mongoose";
// ייבוא צד-אפקט: מבטיח ש-Workspace ו-User נרשמים ב-mongoose לפני populate,
// גם כשהקובץ הזה נטען לבדו ב-bundle נפרד (serverless function).
import "@/lib/models/Workspace";
import "@/lib/models/User";

// קישור בין משתמש ל-workspace שהוא חבר בו. ה-displayName הוא שם תצוגה
// אופציונלי שגובר על ה-name של המשתמש, ספציפית בתוך ה-workspace הזה
// (לדוגמה: "טל" מוצג בתור "דן" בworkspace מסוים).
export interface IWorkspaceMembership {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  displayName?: string;
  createdAt: Date;
}

const WorkspaceMembershipSchema = new Schema<IWorkspaceMembership>({
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  displayName: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
});

WorkspaceMembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
WorkspaceMembershipSchema.index({ userId: 1 });

export default models.WorkspaceMembership ||
  model<IWorkspaceMembership>("WorkspaceMembership", WorkspaceMembershipSchema);
