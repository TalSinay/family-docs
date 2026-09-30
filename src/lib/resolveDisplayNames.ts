import WorkspaceMembership from "@/lib/models/WorkspaceMembership";

type WithUploader<T> = T & { uploadedBy?: { _id: unknown; name?: string } | null };
type WithCreator<T> = T & { createdBy?: { _id: unknown; name?: string } | null };

// מחליף את השם הרגיל (User.name) בשם התצוגה המותאם ל-workspace (WorkspaceMembership.displayName),
// כשקיים כזה. עובד על populated docs עם שדה uploadedBy או createdBy.
async function buildDisplayNameMap(workspaceId: string, userIds: string[]) {
  if (userIds.length === 0) return new Map<string, string>();
  const memberships = await WorkspaceMembership.find({
    workspaceId,
    userId: { $in: userIds },
    displayName: { $exists: true, $ne: "" },
  })
    .select("userId displayName")
    .lean();
  return new Map(memberships.map((m) => [m.userId.toString(), m.displayName as string]));
}

export async function overlayUploaderDisplayNames<T extends WithUploader<unknown>>(
  workspaceId: string,
  docs: T[]
): Promise<T[]> {
  const userIds = docs
    .map((d) => d.uploadedBy?._id)
    .filter(Boolean)
    .map((id) => String(id));
  const map = await buildDisplayNameMap(workspaceId, userIds);
  if (map.size === 0) return docs;
  return docs.map((d) => {
    if (!d.uploadedBy) return d;
    const override = map.get(String(d.uploadedBy._id));
    if (!override) return d;
    return { ...d, uploadedBy: { ...d.uploadedBy, name: override } };
  });
}

export async function overlayCreatorDisplayNames<T extends WithCreator<unknown>>(
  workspaceId: string,
  docs: T[]
): Promise<T[]> {
  const userIds = docs
    .map((d) => d.createdBy?._id)
    .filter(Boolean)
    .map((id) => String(id));
  const map = await buildDisplayNameMap(workspaceId, userIds);
  if (map.size === 0) return docs;
  return docs.map((d) => {
    if (!d.createdBy) return d;
    const override = map.get(String(d.createdBy._id));
    if (!override) return d;
    return { ...d, createdBy: { ...d.createdBy, name: override } };
  });
}
