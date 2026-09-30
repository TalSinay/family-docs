import mongoose, { Schema, models, model } from "mongoose";

export type UserRole = "admin" | "member";

export interface IUser {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: Date;

  // שדות אימות דו-שלבי (OTP) - רלוונטיים רק ל-admin, נדרשים בכל כניסה לאזור הניהול.
  otpCodeHash?: string;
  otpExpiresAt?: Date;
  otpAttempts?: number;

  // שדות "שכחתי סיסמה" - רלוונטיים רק ל-admin, נפרדים משדות ה-OTP של הכניסה הרגילה
  // כדי שלא יתנגשו אם שני התהליכים מתבצעים במקביל.
  resetCodeHash?: string;
  resetExpiresAt?: Date;
  resetAttempts?: number;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ["admin", "member"], default: "member", required: true },
  createdAt: { type: Date, default: Date.now },

  otpCodeHash: { type: String },
  otpExpiresAt: { type: Date },
  otpAttempts: { type: Number, default: 0 },

  resetCodeHash: { type: String },
  resetExpiresAt: { type: Date },
  resetAttempts: { type: Number, default: 0 },
});

export default models.User || model<IUser>("User", UserSchema);
