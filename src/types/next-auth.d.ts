import type { WorkspaceClaim } from "@/lib/auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      isAdmin: boolean;
      workspaces: WorkspaceClaim[];
      activeWorkspaceId: string | null;
      displayName?: string | null;
    };
  }

  interface User {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    isAdmin?: boolean;
    // חותמת הזמן (Date.now()) של אימות ה-OTP האחרון ב-/admin/login - ראו
    // ADMIN_SESSION_MAX_AGE_MS ב-src/lib/auth.ts.
    adminVerifiedAt?: number;
    workspaces?: WorkspaceClaim[];
    activeWorkspaceId?: string;
  }
}
