import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/lib/models/User";
import WorkspaceMembership from "@/lib/models/WorkspaceMembership";

export type WorkspaceClaim = { id: string; name: string; displayName: string };

// הרשאת admin בפועל (isAdmin) בתוקף 48 שעות בלבד מרגע אימות ה-OTP ב-/admin/login,
// בנפרד מה-session הרגיל של האפליקציה (שנשאר מחובר הרבה יותר זמן, כברירת המחדל
// של NextAuth). אחרי 48 שעות, המשתמש חוזר וצריך לעבור את זרימת ה-2FA מחדש כדי
// לגשת לאזור הניהול, גם אם הוא עדיין מחובר כרגיל לאפליקציה.
const ADMIN_SESSION_MAX_AGE_MS = 48 * 60 * 60 * 1000;

// טוען את רשימת ה-workspace-ים שהמשתמש חבר בהם, כולל שם ה-workspace ושם התצוגה
// (displayName) של המשתמש בתוכו - נקרא רק בזמן sign-in / עדכון session, אף פעם
// לא ב-middleware (edge runtime לא תומך בחיבור mongoose).
async function loadWorkspaceClaims(userId: string, fallbackName: string): Promise<WorkspaceClaim[]> {
  await connectToDatabase();
  const memberships = await WorkspaceMembership.find({ userId }).populate("workspaceId").lean();
  return memberships
    .filter((m) => m.workspaceId)
    .map((m) => {
      const ws = m.workspaceId as unknown as { _id: { toString(): string }; name: string };
      return {
        id: ws._id.toString(),
        name: ws.name,
        displayName: m.displayName?.trim() || fallbackName,
      };
    });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    // כניסה רגילה לאפליקציה - אימייל + סיסמה, עבור כל חברי ה-workspace (כולל admin).
    Credentials({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "אימייל", type: "email" },
        password: { label: "סיסמה", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        await connectToDatabase();
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
    // כניסה לאזור הניהול - אימייל + סיסמה + קוד חד-פעמי שנשלח למייל (2FA).
    // נדרש בכל כניסה לאזור, גם עבור המשתמש שכבר מחובר לאפליקציה הרגילה.
    Credentials({
      id: "admin-credentials",
      name: "admin-credentials",
      credentials: {
        email: { label: "אימייל", type: "email" },
        password: { label: "סיסמה", type: "password" },
        otp: { label: "קוד אימות", type: "text" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        const otp = credentials?.otp as string | undefined;
        if (!email || !password || !otp) return null;

        await connectToDatabase();
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user || user.role !== "admin") return null;

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) return null;

        if (!user.otpCodeHash || !user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
          return null;
        }
        if ((user.otpAttempts ?? 0) >= 5) {
          return null;
        }

        const validOtp = await bcrypt.compare(otp, user.otpCodeHash);
        if (!validOtp) {
          user.otpAttempts = (user.otpAttempts ?? 0) + 1;
          await user.save();
          return null;
        }

        // קוד חד-פעמי - מבוטל מיד לאחר שימוש מוצלח.
        user.otpCodeHash = undefined;
        user.otpExpiresAt = undefined;
        user.otpAttempts = 0;
        await user.save();

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        const u = user as { id: string; name?: string | null; role?: string };
        token.id = u.id;
        token.name = u.name;
        token.role = u.role ?? "member";
        // רק כניסה בפועל דרך admin-credentials (אימייל+סיסמה+קוד OTP) מאשרת
        // הרשאת admin - כניסה רגילה של משתמש עם role=admin לא מספיקה, כדי שלא
        // ניתן יהיה לגשת לאזור הניהול בלי לעבור את זרימת ה-2FA (ראו גם
        // ADMIN_SESSION_MAX_AGE_MS בהמשך הקובץ).
        if (account?.provider === "admin-credentials") {
          token.adminVerifiedAt = Date.now();
        }
        const claims = await loadWorkspaceClaims(u.id, u.name || "");
        token.workspaces = claims;
        if (!token.activeWorkspaceId || !claims.some((c) => c.id === token.activeWorkspaceId)) {
          token.activeWorkspaceId = claims[0]?.id;
        }
      }

      // מאפשר למסך "בחירת workspace" להחליף workspace פעיל בלי כניסה מחדש, דרך
      // useSession().update({ activeWorkspaceId }) - וגם טוען מחדש את רשימת ה-
      // workspace-ים מה-DB בכל update (לא רק את הרשימה הישנה מה-JWT), כדי שאם
      // admin שייך את המשתמש ל-workspace חדש באמצע ה-session, הוא יופיע מיד
      // (כולל ב-AppShell שקורא update() פעם אחת בטעינת הדף), בלי צורך בכניסה מחדש.
      if (trigger === "update" && token.id) {
        // עדכון שם אישי מעמוד "אזור אישי" - מגיע מ-useSession().update({ name }), כדי
        // שהשינוי ישתקף מיד בכל מקום שמציג את שם המשתמש בלי צורך בכניסה מחדש.
        if (session?.name && typeof session.name === "string") {
          token.name = session.name;
        }

        const claims = await loadWorkspaceClaims(token.id as string, (token.name as string) || "");
        token.workspaces = claims;
        if (session?.activeWorkspaceId && claims.some((c) => c.id === session.activeWorkspaceId)) {
          token.activeWorkspaceId = session.activeWorkspaceId;
        } else if (!claims.some((c) => c.id === token.activeWorkspaceId)) {
          token.activeWorkspaceId = claims[0]?.id;
        }
      }

      // מחושב בכל קריאה (לא רק בכניסה) - כך שתוקף הרשאת ה-admin פוקע אוטומטית
      // 48 שעות אחרי אימות ה-OTP, בלי צורך בהתנתקות מלאה מהאפליקציה.
      const adminVerifiedAt = token.adminVerifiedAt;
      const adminWindowValid =
        typeof adminVerifiedAt === "number" && Date.now() - adminVerifiedAt < ADMIN_SESSION_MAX_AGE_MS;
      token.isAdmin = token.role === "admin" && adminWindowValid;
      if (!adminWindowValid) token.adminVerifiedAt = undefined;

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const claims = (token.workspaces as WorkspaceClaim[] | undefined) || [];
        const active = claims.find((c) => c.id === token.activeWorkspaceId);
        Object.assign(session.user, {
          id: token.id as string,
          role: token.role as string,
          isAdmin: !!token.isAdmin,
          workspaces: claims,
          activeWorkspaceId: (token.activeWorkspaceId as string | undefined) || null,
          displayName: active?.displayName || session.user.name,
        });
      }
      return session;
    },
  },
});
