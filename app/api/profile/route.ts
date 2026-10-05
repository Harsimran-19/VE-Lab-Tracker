import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { profileSchema } from "@/lib/schema";
import { savePerson } from "@/lib/store";
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext();
    const input = profileSchema.parse(await readJson(request));
    await savePerson({
      ...store.people.find((p) => p.id === identity.personId)!,
      name: input.name,
      reminders: String(input.reminders),
      ...(input.academicRole !== undefined
        ? { academicRole: input.academicRole }
        : {}),
      ...(input.affiliation !== undefined
        ? { affiliation: input.affiliation }
        : {}),
    });
    return NextResponse.json({ saved: true });
  } catch (e) {
    return apiError(e);
  }
}
