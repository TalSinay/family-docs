import mongoose, { Schema, models, model } from "mongoose";
// ייבוא צד-אפקט: מבטיח שמודל "User" נרשם לפני populate("createdBy")
import "@/lib/models/User";
import "@/lib/models/Workspace";

// פריט בודד ברשימת קניות אחת ("רשומת קניות" = יום/ביקור קניות אחד).
export interface IShoppingItem {
  _id: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  // תמונה אופציונלית של המוצר (למשל צילום מסך מהאפליקציה/אתר) - לצפייה
  // בזמן הקניות, לא קובץ מצורף "מסמכי". נשמר ב-collection של File כמו כל קובץ אחר.
  imageFileId?: mongoose.Types.ObjectId;
  inCart: boolean;
}

export interface IShoppingList {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  title: string;
  items: IShoppingItem[];
  // מחושב בכל עדכון: true כש-items לא ריק וכל הפריטים מסומנים inCart
  isCompleted: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ShoppingItemSchema = new Schema<IShoppingItem>({
  name: { type: String, required: true },
  quantity: { type: Number, default: 1, min: 1 },
  imageFileId: { type: Schema.Types.ObjectId, ref: "File" },
  inCart: { type: Boolean, default: false },
});

const ShoppingListSchema = new Schema<IShoppingList>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    title: { type: String, required: true },
    items: { type: [ShoppingItemSchema], default: [] },
    isCompleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

ShoppingListSchema.index({ workspaceId: 1, isCompleted: 1, createdAt: -1 });

export default models.ShoppingList || model<IShoppingList>("ShoppingList", ShoppingListSchema);
