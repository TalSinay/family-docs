"use client";

import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { EXTERNAL_APPS, type ExternalApp } from "@/lib/externalApps";

// מנסה לפתוח custom URL scheme אחד; מחזיר true אם נראה שהדפדפן "עזב" את העמוד
// בתוך הזמן שניתן (כלומר כנראה שהאפליקציה נפתחה), false אם לא.
function tryScheme(scheme: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let appOpened = false;
    const onVisibilityChange = () => {
      if (document.hidden) appOpened = true;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    window.location.href = scheme;

    setTimeout(() => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      resolve(appOpened);
    }, timeoutMs);
  });
}

// מנסה ברצף את כל ה-schemes המועמדים של האפליקציה (ראו הערת אזהרה ב-
// src/lib/externalApps.ts - אלו ניחושים לא מאומתים); ברגע שאחד מהם "עובד"
// (המשתמש עזב את העמוד) עוצרים. אם אף אחד לא עבד, נופלים חזרה לאתר הרשמי.
async function openApp(app: ExternalApp) {
  for (const scheme of app.schemes || []) {
    const opened = await tryScheme(scheme, 700);
    if (opened) return;
  }
  window.open(app.url, "_blank", "noopener,noreferrer");
}

export default function AppsPage() {
  return (
    <div className="space-y-4">
      <Link href="/categories" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowRight size={16} /> חזרה לקטגוריות
      </Link>

      <div>
        <h1 className="text-xl font-bold">📱 האפליקציות שלי</h1>
        <p className="text-sm text-slate-500 mt-1">
          לחיצה על אייקון מנסה לפתוח את האפליקציה המותקנת ישירות (ניחוש, לא מובטח); אם זה לא
          מצליח תוך כמה שניות, ייפתח האתר בדפדפן במקום.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {EXTERNAL_APPS.map((app) => (
          <button
            key={app.id}
            onClick={() => openApp(app)}
            className="card p-5 flex flex-col items-center gap-2 hover:border-teal-300 transition-colors"
          >
            <div
              className={`w-14 h-14 rounded-2xl ${app.color} text-white flex items-center justify-center font-bold text-lg`}
            >
              {app.name.slice(0, 1)}
            </div>
            <span className="font-medium flex items-center gap-1">
              {app.name}
              <ExternalLink size={12} className="text-slate-400" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
