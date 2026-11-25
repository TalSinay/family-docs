import mongoose, { Schema, models, model } from "mongoose";

// טוקן גישה לשרת ה-MCP של workspace אחד. נשמר רק ה-hash (SHA-256); הטוקן עצמו מוצג פעם אחת בעת היצירה.
// לכל workspace טוקן פעיל אחד; יצירה מחדש מחליפה את הקודם (ביטול).
export interface IMcpToken {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  tokenHash: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  lastUsedAt?: Date;
}

const McpTokenSchema = new Schema<IMcpToken>({
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, unique: true },
  tokenHash: { type: String, required: true, unique: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date },
});

export default models.McpToken || model<IMcpToken>("McpToken", McpTokenSchema);
