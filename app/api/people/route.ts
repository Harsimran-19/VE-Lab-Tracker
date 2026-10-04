import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { AppError, requireAdmin, requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { personSchema } from "@/lib/schema";
import { savePerson } from "@/lib/store";
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext(); requireAdmin(identity);
    const body = personSchema.parse(await readJson(request));
    const existing = store.people.find(p => p.id === body.id);
    if (!existing) throw new AppError("Person not found.", 404);
    if (body.email && store.people.some(p => p.id !== body.id && p.email.toLowerCase() === body.email)) throw new AppError("That email is already assigned to another member.", 409);
    const person = { ...existing, ...body };
    await savePerson(person);
    return NextResponse.json({ person });
  } catch (e) { return apiError(e); }
}
