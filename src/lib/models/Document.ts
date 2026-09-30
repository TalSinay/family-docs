import mongoose, { Schema, models, model } from "mongoose";
import { MAIN_CATEGORIES } from "@/lib/categories";
// ייבוא צד-אפקט: מבטיח שמודל "User" נרשם ב-mongoose לפני populate("uploadedBy"),
// גם כשהקובץ הזה נטען לבדו ב-bundle נפרד (serverless function) שלא ייבא את User.ts ישירות.
import "@/lib/models/User";
import "@/lib/models/Workspace";

export interface ICustomField {
  key: string;
  value: string;
}

export interface IDocument {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  title: string;
  category: (typeof MAIN_CATEGORIES)[number];
  subcategory?: string;
  notes?: string;
  externalLink?: string;
  isImportant: boolean;
  customFields: ICustomField[];

  // תאריך יעד אופציונלי (לדוגמה: מועד חידוש ביטוח) - כשמוגדר, מופיע ביומן בתאריך הזה
  dueDate?: string; // "YYYY-MM-DD"
  dueDateTitle?: string; // הכותרת שתוצג ביומן; אם ריק, מוצגת כותרת המסמך עצמו

  amount?: number;
  isMonthlyPayment: boolean;
  monthlyAmount?: number;
  // כדי למנוע כפילות יצירת הוצאה אוטומטית לאותו חודש מאותו מסמך מקור
  generatedForMonths: string[]; // "YYYY-MM"
  generatedFromDocId?: mongoose.Types.ObjectId; // אם זו רשומת הוצאה שנוצרה אוטומטית

  fileId?: mongoose.Types.ObjectId;
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;

  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
  lastOpenedAt: Date;
}

const CustomFieldSchema = new Schema<ICustomField>(
  { key: { type: String, required: true }, value: { type: String, required: true } },
  { _id: false }
);

const DocumentSchema = new Schema<IDocument>({
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
  title: { type: String, required: true },
  category: { type: String, required: true, enum: MAIN_CATEGORIES },
  subcategory: { type: String },
  notes: { type: String },
  externalLink: { type: String },
  isImportant: { type: Boolean, default: false },
  customFields: { type: [CustomFieldSchema], default: [] },

  dueDate: { type: String },
  dueDateTitle: { type: String },

  amount: { type: Number },
  isMonthlyPayment: { type: Boolean, default: false },
  monthlyAmount: { type: Number },
  generatedForMonths: { type: [String], default: [] },
  generatedFromDocId: { type: Schema.Types.ObjectId, ref: "Document" },

  fileId: { type: Schema.Types.ObjectId, ref: "File" },
  fileName: { type: String },
  fileMimeType: { type: String },
  fileSize: { type: Number },

  uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  uploadedAt: { type: Date, default: Date.now },
  lastOpenedAt: { type: Date, default: Date.now },
});

DocumentSchema.index({ workspaceId: 1, category: 1, subcategory: 1 });
DocumentSchema.index({ workspaceId: 1, isImportant: 1 });
DocumentSchema.index({ workspaceId: 1, lastOpenedAt: -1 });
DocumentSchema.index({ workspaceId: 1, uploadedAt: -1 });
DocumentSchema.index({ workspaceId: 1, dueDate: 1 });

export default models.Document || model<IDocument>("Document", DocumentSchema);
