"use client";

import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { BottomNav } from "./BottomNav";
import { UploadButton } from "./UploadButton";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

const AUTH_PAGES = ["/login", "/admin/login"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAuthPage = AUTH_PAGES.includes(pathname);
  const isAdminArea = pathname.startsWith("/admin");

  if (isAuthPage) {
    return <main className="flex-1 flex items-center justify-center p-4">{children}</main>;
  }

  // אזור הניהול מנהל את עיצוב הכותרת שלו בעצמו (src/app/admin/layout.tsx).
  if (isAdminArea) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/dashboard" className="font-bold text-teal-800 text-lg shrink-0">
            📁 תיק המשפחה
          </Link>
          {session?.user && (
            <div className="flex items-center gap-3 text-sm text-slate-500 min-w-0">
              {session.user.workspaces && session.user.workspaces.length > 1 && (
                <WorkspaceSwitcher
                  workspaces={session.user.workspaces}
                  activeWorkspaceId={session.user.activeWorkspaceId}
                />
              )}
              <span className="truncate">שלום, {session.user.displayName || session.user.name}</span>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="p-1.5 rounded-full hover:bg-slate-100 shrink-0"
                aria-label="התנתקות"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 pb-28">{children}</main>

      {session?.user && <UploadButton />}
      {session?.user && <BottomNav />}
    </>
  );
}
