"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search as SearchIcon, ListChecks, CalendarDays, ShoppingCart } from "lucide-react";
import { DocumentCard } from "@/components/DocumentCard";
import { formatDate } from "@/lib/format";

type DocResult = {
  _id: string;
  title: string;
  category: string;
  subcategory?: string;
  isImportant?: boolean;
  amount?: number;
  uploadedAt: string;
};
type TaskResult = { _id: string; title: string; dueDate?: string; isDone: boolean };
type EventResult = { _id: string; title: string; date: string };
type ShoppingResult = { _id: string; title: string; isCompleted: boolean; matchingItems: string[] };

type SearchResults = {
  documents: DocResult[];
  tasks: TaskResult[];
  calendarEvents: EventResult[];
  shoppingLists: ShoppingResult[];
};

const EMPTY: SearchResults = { documents: [], tasks: [], calendarEvents: [], shoppingLists: [] };

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ניקוי תוצאות בתגובה לשינוי השאילתה, לא לולאת render
      setResults(EMPTY);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) setResults(await res.json());
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const hasQuery = query.trim().length >= 2;
  const totalResults =
    results.documents.length +
    results.tasks.length +
    results.calendarEvents.length +
    results.shoppingLists.length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">חיפוש</h1>
        <p className="text-sm text-slate-500">חיפוש בכל המסמכים, המשימות, היומן ורשימות הקניות</p>
      </div>

      <div className="relative">
        <SearchIcon size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          className="input pr-10"
          placeholder="הקלד לפחות 2 תווים..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!hasQuery && (
        <p className="text-sm text-slate-400 text-center py-10">התחל להקליד כדי לחפש.</p>
      )}

      {hasQuery && loading && (
        <p className="text-sm text-slate-400 text-center py-6">מחפש...</p>
      )}

      {hasQuery && !loading && totalResults === 0 && (
        <p className="text-sm text-slate-400 text-center py-10">לא נמצאו תוצאות עבור &quot;{query}&quot;.</p>
      )}

      {hasQuery && !loading && results.documents.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium text-slate-400">מסמכים</h2>
          {results.documents.map((doc) => (
            <DocumentCard key={doc._id} doc={doc} />
          ))}
        </section>
      )}

      {hasQuery && !loading && results.tasks.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium text-slate-400">משימות</h2>
          {results.tasks.map((task) => (
            <Link
              key={task._id}
              href="/tasks"
              className="card flex items-center gap-3 p-3.5 hover:border-teal-300 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                <ListChecks size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${task.isDone ? "line-through text-slate-400" : ""}`}>
                  {task.title}
                </p>
                {task.dueDate && (
                  <p className="text-xs text-slate-500">תאריך יעד: {formatDate(task.dueDate)}</p>
                )}
              </div>
            </Link>
          ))}
        </section>
      )}

      {hasQuery && !loading && results.calendarEvents.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium text-slate-400">אירועי יומן</h2>
          {results.calendarEvents.map((ev) => (
            <Link
              key={ev._id}
              href="/calendar"
              className="card flex items-center gap-3 p-3.5 hover:border-teal-300 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                <CalendarDays size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{ev.title}</p>
                <p className="text-xs text-slate-500">{formatDate(ev.date)}</p>
              </div>
            </Link>
          ))}
        </section>
      )}

      {hasQuery && !loading && results.shoppingLists.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium text-slate-400">רשימות קניות</h2>
          {results.shoppingLists.map((list) => (
            <Link
              key={list._id}
              href={`/shopping/${list._id}`}
              className="card flex items-center gap-3 p-3.5 hover:border-teal-300 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                <ShoppingCart size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${list.isCompleted ? "text-slate-500" : ""}`}>
                  {list.title}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  נמצא: {list.matchingItems.join(", ")}
                </p>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
