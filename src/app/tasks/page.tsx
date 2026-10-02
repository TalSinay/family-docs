"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Trash2, CalendarDays, Pencil, Check, X } from "lucide-react";
import clsx from "clsx";
import { ColorPicker } from "@/components/ColorPicker";
import { DEFAULT_TASK_COLOR } from "@/lib/itemColors";

// בונה תווית תאריך "ידנית" מ"YYYY-MM-DD" (בלי new Date(str) שמפורש כ-UTC) כדי למנוע היסט יום
function formatDueDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short" }).format(
    new Date(y, m - 1, d)
  );
}

type TaskItem = {
  _id: string;
  title: string;
  dueDate?: string;
  isDone: boolean;
  color?: string;
  createdBy?: { name?: string } | null;
  createdAt: string;
};

function isOverdue(task: TaskItem, todayStr: string) {
  return !task.isDone && !!task.dueDate && task.dueDate < todayStr;
}

export default function TasksPage() {
  // ה-workspace הפעיל, כדי שמעבר בין workspace-ים ירענן מיד את רשימת המשימות.
  const { data: session } = useSession();
  const activeWorkspaceId = session?.user?.activeWorkspaceId;

  const [mounted, setMounted] = useState(false);
  const [todayStr, setTodayStr] = useState("");
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [color, setColor] = useState(DEFAULT_TASK_COLOR);
  const [submitting, setSubmitting] = useState(false);

  // עריכת משימה קיימת (נפתח inline בתוך השורה, ראו TaskRow)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editColor, setEditColor] = useState(DEFAULT_TASK_COLOR);

  useEffect(() => {
    const now = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- "היום" נקבע רק בדפדפן, כדי להימנע מפער אזורי-זמן שרת/לקוח
    setTodayStr(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    );
    setMounted(true);
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) setTasks(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- טעינת המשימות לפי workspace, לא לולאת render
    fetchTasks();
    // activeWorkspaceId בתלויות בכוונה: מעבר workspace מרענן מיד, בלי ניווט מלא.
  }, [mounted, fetchTasks, activeWorkspaceId]);

  async function addTask() {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, dueDate: dueDate || undefined, color }),
      });
      if (res.ok) {
        setTitle("");
        setDueDate("");
        setColor(DEFAULT_TASK_COLOR);
        fetchTasks();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(task: TaskItem) {
    setEditingId(task._id);
    setEditTitle(task.title);
    setEditDueDate(task.dueDate || "");
    setEditColor(task.color || DEFAULT_TASK_COLOR);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim()) return;
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle.trim(),
        dueDate: editDueDate || "",
        color: editColor,
      }),
    });
    if (res.ok) {
      setEditingId(null);
      fetchTasks();
    }
  }

  async function toggleDone(task: TaskItem) {
    // עדכון אופטימי - כדי שהסימון ירגיש מיידי
    setTasks((prev) =>
      prev.map((t) => (t._id === task._id ? { ...t, isDone: !t.isDone } : t))
    );
    const res = await fetch(`/api/tasks/${task._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDone: !task.isDone }),
    });
    if (res.ok) fetchTasks();
  }

  async function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t._id !== id));
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  }

  if (!mounted) {
    return <div className="card p-8 text-center text-sm text-slate-400">טוען משימות...</div>;
  }

  const openTasks = tasks.filter((t) => !t.isDone);
  const doneTasks = tasks.filter((t) => t.isDone);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">משימות</h1>
        <p className="text-sm text-slate-500">רשימת המשימות המשפחתית</p>
      </div>

      <div className="card p-4 space-y-2">
        <input
          className="input"
          placeholder="משימה חדשה..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
        />
        {title && (
          <>
            <div>
              <label className="label">תאריך יעד (אופציונלי)</label>
              <input
                type="date"
                className="input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <ColorPicker value={color} onChange={setColor} />
            <button
              onClick={addTask}
              disabled={submitting}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Plus size={16} /> הוסף משימה
            </button>
          </>
        )}
      </div>

      {loading && <p className="text-sm text-slate-400 text-center py-8">טוען...</p>}

      {!loading && (
        <div className="space-y-2">
          {openTasks.length === 0 && doneTasks.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">
              אין משימות עדיין. הוסף אחת למעלה.
            </p>
          )}

          {openTasks.map((task) => (
            <TaskRow
              key={task._id}
              task={task}
              overdue={isOverdue(task, todayStr)}
              onToggle={toggleDone}
              onDelete={deleteTask}
              isEditing={editingId === task._id}
              editTitle={editTitle}
              editDueDate={editDueDate}
              editColor={editColor}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
              onSaveEdit={saveEdit}
              onEditTitleChange={setEditTitle}
              onEditDueDateChange={setEditDueDate}
              onEditColorChange={setEditColor}
            />
          ))}

          {doneTasks.length > 0 && (
            <div className="pt-2">
              <p className="text-xs text-slate-400 font-medium mb-2">בוצעו</p>
              <div className="space-y-2">
                {doneTasks.map((task) => (
                  <TaskRow
                    key={task._id}
                    task={task}
                    overdue={false}
                    onToggle={toggleDone}
                    onDelete={deleteTask}
                    isEditing={editingId === task._id}
                    editTitle={editTitle}
                    editDueDate={editDueDate}
                    editColor={editColor}
                    onStartEdit={startEdit}
                    onCancelEdit={cancelEdit}
                    onSaveEdit={saveEdit}
                    onEditTitleChange={setEditTitle}
                    onEditDueDateChange={setEditDueDate}
                    onEditColorChange={setEditColor}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  overdue,
  onToggle,
  onDelete,
  isEditing,
  editTitle,
  editDueDate,
  editColor,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditTitleChange,
  onEditDueDateChange,
  onEditColorChange,
}: {
  task: TaskItem;
  overdue: boolean;
  onToggle: (task: TaskItem) => void;
  onDelete: (id: string) => void;
  isEditing: boolean;
  editTitle: string;
  editDueDate: string;
  editColor: string;
  onStartEdit: (task: TaskItem) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onEditTitleChange: (v: string) => void;
  onEditDueDateChange: (v: string) => void;
  onEditColorChange: (v: string) => void;
}) {
  const color = task.color || DEFAULT_TASK_COLOR;

  if (isEditing) {
    return (
      <div className="card p-3.5 space-y-2">
        <input
          className="input"
          value={editTitle}
          onChange={(e) => onEditTitleChange(e.target.value)}
          placeholder="כותרת"
        />
        <input
          type="date"
          className="input"
          value={editDueDate}
          onChange={(e) => onEditDueDateChange(e.target.value)}
        />
        <ColorPicker value={editColor} onChange={onEditColorChange} />
        <div className="flex gap-2">
          <button
            onClick={() => onSaveEdit(task._id)}
            className="btn-primary flex items-center gap-1 text-sm px-3 py-1.5"
          >
            <Check size={14} /> שמירה
          </button>
          <button onClick={onCancelEdit} className="btn-secondary flex items-center gap-1 text-sm px-3 py-1.5">
            <X size={14} /> ביטול
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card flex items-center gap-3 p-3.5" style={{ borderInlineStartWidth: 4, borderInlineStartColor: color }}>
      <button
        onClick={() => onToggle(task)}
        aria-label={task.isDone ? "סמן כלא בוצע" : "סמן כבוצע"}
        className={clsx(
          "w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
          task.isDone ? "border-transparent" : "border-slate-300 hover:border-teal-500"
        )}
        style={task.isDone ? { backgroundColor: color } : undefined}
      >
        {task.isDone && <span className="w-2 h-2 rounded-full bg-white" />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={clsx("font-medium truncate", task.isDone && "line-through text-slate-400")}>
          {task.title}
        </p>
        {task.dueDate && (
          <p
            className={clsx(
              "text-xs mt-0.5 flex items-center gap-1",
              overdue ? "text-red-600 font-medium" : "text-slate-500"
            )}
          >
            <CalendarDays size={12} /> {formatDueDate(task.dueDate)}
            {overdue && " · באיחור"}
          </p>
        )}
      </div>

      <button onClick={() => onStartEdit(task)} className="shrink-0 text-slate-400 hover:text-teal-700">
        <Pencil size={16} />
      </button>
      <button onClick={() => onDelete(task._id)} className="shrink-0 text-slate-400 hover:text-red-600">
        <Trash2 size={16} />
      </button>
    </div>
  );
}
