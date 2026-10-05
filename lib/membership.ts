import { createHash } from "node:crypto";
export function membershipId(personId: string, projectId: string) {
  return `join-${createHash("sha256")
    .update(JSON.stringify([personId, projectId]))
    .digest("hex")
    .slice(0, 32)}`;
}
