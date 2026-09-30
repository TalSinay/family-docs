"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { WorkspaceClaim } from "@/lib/auth";

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: WorkspaceClaim[];
  activeWorkspaceId: string | null;
}) {
  const { update } = useSession();
  const router = useRouter();

  async function handleChange(id: string) {
    await update({ activeWorkspaceId: id });
    router.refresh();
  }

  return (
    <select
      className="text-sm border border-slate-300 rounded-lg px-2 py-1 bg-white max-w-[7.5rem]"
      value={activeWorkspaceId || ""}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="בחירת workspace"
    >
      {workspaces.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name}
        </option>
      ))}
    </select>
  );
}
