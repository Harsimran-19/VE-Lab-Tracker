import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { AppError, requireAdmin, requireSameOrigin, validatePersonChange } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { newPersonSchema, personSchema } from "@/lib/schema";
import { addPerson, savePerson } from "@/lib/store";
import { adminEmails } from "@/lib/config";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext(); requireAdmin(identity);
    const body = newPersonSchema.parse(await readJson(request));
    const person = { ...body, id: crypto.randomUUID() };
    validatePersonChange(store, identity, person, adminEmails());
    await addPerson(person);
    return NextResponse.json({ person }, { status: 201 });
  } catch (e) { return apiError(e); }
}
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext(); requireAdmin(identity);
    const body = personSchema.parse(await readJson(request));
    const existing = store.people.find(p => p.id === body.id);
    if (!existing) throw new AppError("Person not found.", 404);
    const person = { ...existing, ...body, role: body.role ?? existing.role };
    validatePersonChange(store, identity, person, adminEmails());
    await savePerson(person);
    return NextResponse.json({ person });
  } catch (e) { return apiError(e); }
}
