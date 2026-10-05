import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { AppError, requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { profileSchema } from "@/lib/schema";
import { savePerson, saveProfile } from "@/lib/store";
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext();
    const input = profileSchema.parse(await readJson(request));
    const person = store.people.find((p) => p.id === identity.personId);
    if (!person)
      throw new AppError(
        "Initialize the spreadsheet before editing your profile.",
        409,
      );
    await saveProfile({
      id: person.id,
      position: input.position,
      expertise: input.expertise,
      bio: input.bio,
      reminders: String(input.reminders),
    });
    await savePerson({
      ...person,
      name: input.name,
      affiliation: input.affiliation,
    });
    return NextResponse.json({ saved: true });
  } catch (e) {
    return apiError(e);
  }
}
