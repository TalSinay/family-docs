import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/lib/models/User";
import WorkspaceMembership from "@/lib/models/WorkspaceMembership";

export type WorkspaceClaim = { id: string; name: string; displayName: string };

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
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as { id: string; name?: string | null; role?: string };
        token.id = u.id;
        token.role = u.role ?? "member";
        token.isAdmin = u.role === "admin";
        const claims = await loadWorkspaceClaims(u.id, u.name || "");
        token.workspaces = claims;
        if (!token.activeWorkspaceId || !claims.some((c) => c.id === token.activeWorkspaceId)) {
          token.activeWorkspaceId = claims[0]?.id;
        }
      }

      // מאפשר למסך "בחירת workspace" להחליף workspace פעיל בלי כניסה מחדש,
      // דרך useSession().update({ activeWorkspaceId }).
      if (trigger === "update" && session?.activeWorkspaceId) {
        const claims = (token.workspaces as WorkspaceClaim[] | undefined) || [];
        if (claims.some((c) => c.id === session.activeWorkspaceId)) {
          token.activeWorkspaceId = session.activeWorkspaceId;
        }
      }

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
