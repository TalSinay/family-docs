"use client";

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { LogOut, ArrowRight } from "lucide-react";
import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return <div className="flex-1 flex items-center justify-center p-4">{children}</div>;
  }

  return (
    <div className="min-h-full flex flex-col bg-slate-50">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/admin" className="font-bold text-teal-800 text-lg">
            🔐 אזור ניהול
          </Link>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <Link href="/dashboard" className="flex items-center gap-1 hover:text-slate-700">
              <ArrowRight size={16} /> חזרה לאפליקציה
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="p-1.5 rounded-full hover:bg-slate-100"
              aria-label="התנתקות"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
