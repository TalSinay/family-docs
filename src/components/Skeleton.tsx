// שלדי טעינה: המבנה מופיע מיד, במקום "טוען...". האנימציה (shimmer) ב-globals.css.
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="טוען">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card flex items-center gap-3 p-4">
          <div className="skeleton w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-2/3 rounded-md" />
            <div className="skeleton h-3 w-1/3 rounded-md" />
          </div>
          <div className="skeleton h-4 w-10 rounded-md" />
        </div>
      ))}
    </div>
  );
}
