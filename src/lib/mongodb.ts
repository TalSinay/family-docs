import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "חסר MONGODB_URI בקובץ .env.local - העתק connection string מ-MongoDB Atlas"
  );
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// שמירת החיבור בין hot-reloads בפיתוח, ובין invocations serverless בפרודקשן
declare global {
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cache;

export async function connectToDatabase() {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI as string, {
      bufferCommands: false,
      // מגביל את מספר החיבורים המקבילים ל-Mongo. ברירת המחדל (עד 100) פותחת
      // הרבה handshake-ים בו-זמנית, ורשתות מסוימות (VPN/פרוקסי ארגוני) גורמות
      // לחלק מהם להיכשל ב-auth בצורה לא עקבית. מספר נמוך יותר פותר את זה,
      // ומספיק בנוחות לשימוש משפחתי (עד 10 משתמשים בו-זמנית).
      maxPoolSize: 5,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 10000,
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
