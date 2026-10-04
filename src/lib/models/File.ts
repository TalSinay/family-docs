import mongoose, { Schema, models, model } from "mongoose";

// קובץ בינארי אחד = מסמך אחד ב-collection הזה. ללא GridFS (הקבצים לא גדולים).
// מגבלה מעשית: כ-11MB לקובץ מקורי (מגבלת 16MB למסמך ב-Mongo, אחרי base64/overhead).
export interface IFile {
  _id: mongoose.Types.ObjectId;
  // ה-workspace שבתוכו הועלה הקובץ - חותם אבטחה בלתי-תלוי בזה שהקובץ אכן מקושר
  // ממסמך כלשהו, כדי שלא ניתן יהיה "לקשר" קובץ שהועלה ב-workspace אחד למסמך
  // ב-workspace אחר (למשל ע"י משתמש שמשויך לשניהם) ולדלוף אותו דרך זה.
  workspaceId: mongoose.Types.ObjectId;
  filename: string;
  mimeType: string;
  size: number;
  data: Buffer;
  createdAt: Date;
}

const FileSchema = new Schema<IFile>({
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
  filename: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  data: { type: Buffer, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default models.File || model<IFile>("File", FileSchema);
