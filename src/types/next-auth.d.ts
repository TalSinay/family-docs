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
    workspaces?: WorkspaceClaim[];
    activeWorkspaceId?: string;
  }
}
