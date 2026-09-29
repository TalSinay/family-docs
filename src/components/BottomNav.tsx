"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Star, CalendarDays, Clock, Home } from "lucide-react";
import clsx from "clsx";

const items = [
  { href: "/dashboard", label: "בית", icon: Home },
  { href: "/categories", label: "קטגוריות", icon: LayoutGrid },
  { href: "/recent", label: "אחרונים", icon: Clock },
  { href: "/important", label: "חשובים", icon: Star },
  { href: "/calendar", label: "יומן", icon: CalendarDays },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-3xl mx-auto grid grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                active ? "text-teal-700" : "text-slate-400"
              )}
            >
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
