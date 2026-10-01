import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { EXTERNAL_APPS } from "@/lib/externalApps";

export default function AppsPage() {
  return (
    <div className="space-y-4">
      <Link href="/categories" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowRight size={16} /> חזרה לקטגוריות
      </Link>

      <div>
        <h1 className="text-xl font-bold">📱 האפליקציות שלי</h1>
        <p className="text-sm text-slate-500 mt-1">
          לחיצה על אייקון פותחת את האפליקציה הרשמית אם היא מותקנת בטלפון, או את האתר בדפדפן אם לא.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {EXTERNAL_APPS.map((app) => (
          <a
            key={app.id}
            href={app.url}
            target="_blank"
            rel="noopener noreferrer"
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
          </a>
        ))}
      </div>
    </div>
  );
}
