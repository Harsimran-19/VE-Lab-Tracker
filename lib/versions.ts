import { AppError, requireProjectAccess } from "./access";
import { versionSchema } from "./schema";
import type { Identity, OutputVersion, Store } from "./types";

// Data, paper and code items keep every version; nothing is edited or removed.
export function planVersion(store: Store, identity: Identity, raw: unknown, now = new Date()): OutputVersion {
  const input = versionSchema.parse(raw);
  const project = store.projects.find(p => p.id === input.projectId);
  if (!project) throw new AppError("Project not found.", 404);
  requireProjectAccess(store, identity, project);
  if (project.approval === "rejected") throw new AppError("This project was not approved.", 409);
  const existing = store.versions.find(v => v.id === input.id);
  if (existing) {
    if (existing.outputId !== input.outputId || existing.url !== input.url || existing.notes !== input.notes)
      throw new AppError("This version already exists. Refresh to review it.", 409);
    return existing;
  }
  const history = store.versions.filter(v => v.outputId === input.outputId);
  if (history.some(v => v.projectId !== project.id)) throw new AppError("This item belongs to another project.", 403);
  if (!history.length && store.versions.filter(v => v.projectId === project.id && v.kind === input.kind).some(v => v.name.toLowerCase() === input.name.toLowerCase()))
    throw new AppError(`This project already has ${input.kind.toLowerCase()} named “${input.name}”. Add a version to it instead.`, 409);
  if (history.length >= 500) throw new AppError("This item already has 500 versions.");
  // The first version fixes the item's kind and name.
  const first = history[0];
  return {
    id: input.id,
    projectId: project.id,
    outputId: input.outputId,
    kind: first?.kind ?? input.kind,
    name: first?.name ?? input.name,
    url: input.url,
    notes: input.notes,
    personId: identity.personId,
    createdAt: now.toISOString(),
  };
}
// Version numbers follow creation order within each item.
export function versionHistory(versions: OutputVersion[], outputId: string) {
  return versions
    .filter(v => v.outputId === outputId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((v, i) => ({ ...v, number: i + 1 }));
}
