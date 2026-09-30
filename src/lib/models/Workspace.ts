import mongoose, { Schema, models, model } from "mongoose";

// workspace (״בית אב״) - מכיל את כל המידע (מסמכים, אירועים, משימות) של קבוצת משתמשים אחת.
// רק admin יכול ליצור workspace חדש.
export interface IWorkspace {
  _id: mongoose.Types.ObjectId;
  name: string;
  createdAt: Date;
}

const WorkspaceSchema = new Schema<IWorkspace>({
  name: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

export default models.Workspace || model<IWorkspace>("Workspace", WorkspaceSchema);
