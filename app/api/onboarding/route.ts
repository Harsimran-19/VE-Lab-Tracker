import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { AppError, requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { onboardingSchema } from "@/lib/schema";
import { rosterCandidate } from "@/lib/onboarding";
import { membershipId } from "@/lib/membership";
import {
  saveAssignment,
  savePerson,
  saveProfile,
  saveOnboarding,
} from "@/lib/store";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext();
    const input = onboardingSchema.parse(await readJson(request));
    const person = store.people.find((p) => p.id === identity.personId);
    if (!person) throw new AppError("Your account could not be found.", 404);
    const existing = store.onboarding?.find((r) => r.id === person.id);
    if (existing?.completedAt) return NextResponse.json({ saved: true });
    if (input.rosterId && input.rosterId !== person.id)
      rosterCandidate(store, input.rosterId, identity);
    if (input.projectIds.some((id) => !store.projects.some((p) => p.id === id)))
      throw new AppError("Choose an existing lab project.");
    const profile = store.profiles?.find((p) => p.id === person.id);
    await saveProfile({
      id: person.id,
      position: input.position,
      expertise: input.expertise,
      bio: profile?.bio ?? "",
      reminders: profile?.reminders ?? "true",
    });
    await savePerson({ ...person, name: input.name });
    for (const projectId of new Set(input.projectIds)) {
      if (
        !store.assignments.some(
          (a) => a.projectId === projectId && a.personId === person.id,
        )
      )
        await saveAssignment(
          {
            id: membershipId(person.id, projectId),
            projectId,
            personId: person.id,
            responsibility: "Project work",
            status: "In progress",
            due: "",
          },
          false,
        );
    }
    await saveOnboarding({
      id: person.id,
      completedAt: new Date().toISOString(),
      rosterId: input.rosterId,
      status:
        input.rosterId && input.rosterId !== person.id ? "pending" : "linked",
      requesterEmail: identity.email,
    });
    return NextResponse.json({ saved: true });
  } catch (e) {
    return apiError(e);
  }
}
