import mongoose, { Schema, models, model } from "mongoose";

// שורת "פירוט" מקובץ בנק/אשראי, לעמודי פירוט הוצאות/הכנסות בלבד. בכוונה אוסף נפרד מ-Document:
// הרשומות האלה לא נספרות בסיכומים החודשיים, בדשבורד, בדוחות או בהוצאות/הכנסות הרגילות.
export interface IDetailEntry {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  kind: "הוצאות" | "הכנסות";
  title: string; // בית העסק / תיאור התנועה
  amount: number; // חיובי תמיד; הסוג נקבע לפי kind
  date: string; // "YYYY-MM-DD"
  importBatchId: string;
  importFileName?: string;
  createdAt: Date;
}

const DetailEntrySchema = new Schema<IDetailEntry>({
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
  kind: { type: String, enum: ["הוצאות", "הכנסות"], required: true },
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  importBatchId: { type: String, required: true },
  importFileName: { type: String },
  createdAt: { type: Date, default: Date.now },
});

DetailEntrySchema.index({ workspaceId: 1, kind: 1, date: -1 });
DetailEntrySchema.index({ workspaceId: 1, importBatchId: 1 });

export default models.DetailEntry || model<IDetailEntry>("DetailEntry", DetailEntrySchema);
