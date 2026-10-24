import mongoose, { Schema, models, model } from "mongoose";
import "@/lib/models/User";

// מילה/ביטוי שהמשפחה לימדה את הפענוח המקומי של "הוספה מהירה" (ראו src/lib/quickAdd).
// למשל "יש לי" ← מסמך חדש. נשמר לכל workspace, ומתמזג על מילון ברירת המחדל.
export interface IQuickAddWord {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  word: string; // מנורמל: בלי ניקוד/גרשיים
  intent?: "expense" | "income" | "task" | "reminder" | "shopping" | "question" | "document";
  category?: string; // קטגוריית מסמך ראשית (מילה ← קטגוריה), למשל "פוליסה" ← ביטוחים
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const QuickAddWordSchema = new Schema<IQuickAddWord>({
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
  word: { type: String, required: true },
  intent: {
    type: String,
    enum: ["expense", "income", "task", "reminder", "shopping", "question", "document"],
  },
  category: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

QuickAddWordSchema.index({ workspaceId: 1, word: 1 }, { unique: true });

export default models.QuickAddWord || model<IQuickAddWord>("QuickAddWord", QuickAddWordSchema);
