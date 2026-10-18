import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { AppError, isLive, requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { onboardingSchema } from "@/lib/schema";
import { membershipId } from "@/lib/membership";
import { savePerson, mutateProjectDomain } from "@/lib/store";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext();
    const input = onboardingSchema.parse(await readJson(request));
    const person = store.people.find((p) => p.id === identity.personId)!;
    if (person.setupComplete === "true")
      return NextResponse.json({ saved: true });
    await mutateProjectDomain(identity, "Project team", "Joined project", (latest, current) => {
      if (input.projectIds.some(id => !latest.projects.some(p => p.id === id && isLive(p)))) throw new AppError("Choose an active lab project.");
      for (const projectId of new Set(input.projectIds)) {
        if (!latest.memberships.some(m => m.projectId === projectId && m.personId === current.personId)) latest.memberships.push({ id: membershipId(current.personId, projectId), projectId, personId: current.personId, joinedAt: new Date().toISOString(), contributor: true, supervisor: false });
      }
    });
    await savePerson({ ...person, name: input.name, setupComplete: "true" });
    return NextResponse.json({ saved: true });
  } catch (e) {
    return apiError(e);
  }
}
