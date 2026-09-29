"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ההרשמה נכשלה");

      const signInRes = await signIn("credentials", { email, password, redirect: false });
      if (signInRes?.error) throw new Error("ההרשמה הצליחה אך ההתחברות נכשלה, נסה להתחבר ידנית");

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה לא צפויה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="text-4xl mb-2">📁</div>
        <h1 className="text-2xl font-bold text-teal-800">תיק המשפחה</h1>
        <p className="text-slate-500 text-sm mt-1">הצטרפות כבן משפחה (עד 10 משתמשים)</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2">{error}</div>
        )}
        <div>
          <label className="label">שם מלא</label>
          <input required className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">אימייל</label>
          <input
            type="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label">סיסמה (6 תווים לפחות)</label>
          <input
            type="password"
            required
            minLength={6}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "נרשם..." : "הרשמה"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-4">
        כבר יש לך חשבון?{" "}
        <Link href="/login" className="text-teal-700 font-medium">
          התחברות
        </Link>
      </p>
    </div>
  );
}
