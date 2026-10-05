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

export interface IAttachment {
  fileId: mongoose.Types.ObjectId;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
}

export interface IAmountHistoryEntry {
  amount: number;
  at: Date;
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

  // שדות ייעודיים לקטגוריית "פיננסים" בלבד (מקום מרוכז לאיפה הכסף נמצא)
  platformName?: string; // שם הפלטפורמה/הגוף, לדוגמה "הפניקס", "Bitcoin"
  expectedReturn?: number; // תשואה/רווח צפוי באחוזים
  commissionFee?: number; // עמלה באחוזים
  targetAmount?: number; // סכום יעד (להצגת התקדמות)
  isLiability?: boolean; // התחייבות/חוב - מופחת מהסה"כ ולא נספר כנכס
  amountHistory?: IAmountHistoryEntry[]; // היסטוריית עדכוני הסכום (עד MAX_AMOUNT_HISTORY אחרונים)

  // כדי למנוע כפילות יצירת הוצאה אוטומטית לאותו חודש מאותו מסמך מקור
  generatedForMonths: string[]; // "YYYY-MM"
  generatedFromDocId?: mongoose.Types.ObjectId; // אם זו רשומת הוצאה שנוצרה אוטומטית

  // שדות הקובץ הבודד (fileId/fileName/...) נשארים כאן למסמכים ישנים בלבד -
  // מסמכים חדשים נשמרים כולם ב-attachments (מערך), גם כשיש קובץ אחד בלבד.
  fileId?: mongoose.Types.ObjectId;
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  attachments: IAttachment[];

  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
  lastOpenedAt: Date;
}

const CustomFieldSchema = new Schema<ICustomField>(
  { key: { type: String, required: true }, value: { type: String, required: true } },
  { _id: false }
);

const AttachmentSchema = new Schema<IAttachment>(
  {
    fileId: { type: Schema.Types.ObjectId, ref: "File", required: true },
    fileName: { type: String, required: true },
    fileMimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
  },
  { _id: false }
);

const AmountHistorySchema = new Schema<IAmountHistoryEntry>(
  { amount: { type: Number, required: true }, at: { type: Date, required: true } },
  { _id: false }
);

export const MAX_AMOUNT_HISTORY = 50;

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
  platformName: { type: String },
  expectedReturn: { type: Number },
  commissionFee: { type: Number },
  targetAmount: { type: Number },
  isLiability: { type: Boolean, default: false },
  amountHistory: { type: [AmountHistorySchema], default: [] },
  generatedForMonths: { type: [String], default: [] },
  generatedFromDocId: { type: Schema.Types.ObjectId, ref: "Document" },

  fileId: { type: Schema.Types.ObjectId, ref: "File" },
  fileName: { type: String },
  fileMimeType: { type: String },
  fileSize: { type: Number },
  attachments: { type: [AttachmentSchema], default: [] },

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
