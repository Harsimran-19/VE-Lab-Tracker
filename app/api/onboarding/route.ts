import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { AppError, requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { onboardingSchema } from "@/lib/schema";
import { membershipId } from "@/lib/membership";
import { savePerson, saveMembership } from "@/lib/store";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext();
    const input = onboardingSchema.parse(await readJson(request));
    const person = store.people.find((p) => p.id === identity.personId)!;
    if (person.setupComplete === "true")
      return NextResponse.json({ saved: true });
    if (
      input.projectIds.some(
        (id) =>
          !store.projects.some((p) => p.id === id && p.state === "active"),
      )
    )
      throw new AppError("Choose an active lab project.");
    for (const projectId of new Set(input.projectIds)) {
      const existing = store.memberships.find(
        (m) => m.projectId === projectId && m.personId === person.id,
      );
      if (!existing)
        await saveMembership({
          id: membershipId(person.id, projectId),
          projectId,
          personId: person.id,
          joinedAt: new Date().toISOString(),
        });
    }
    await savePerson({ ...person, name: input.name, setupComplete: "true" });
    return NextResponse.json({ saved: true });
  } catch (e) {
    return apiError(e);
  }
}
