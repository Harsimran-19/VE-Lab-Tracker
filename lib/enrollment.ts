import { createHash } from "node:crypto";
import { z } from "zod";
import type { Person, Store } from "./types";

const googleProfile = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  email_verified: z.literal(true), name: z.string().optional()
});
export function verifiedGoogleLogin(provider: string | undefined, profile: unknown) {
  if (provider !== "google") return null;
  const result = googleProfile.safeParse(profile);
  if (!result.success) return null;
  return { email: result.data.email, name: (result.data.name?.trim() || result.data.email).slice(0,150) };
}
export function googleMember(login: {email:string;name:string}, store: Store): Person {
  const existing = store.people.find(p=>p.email.trim().toLowerCase()===login.email);
  if (existing) return existing;
  // Stable identity also makes concurrent first logins across server instances converge.
  return { id:`google-${createHash("sha256").update(login.email).digest("hex").slice(0,32)}`, ...login, affiliation:"", role:"member" };
}
export async function enrollGoogleAccount(provider:string|undefined, profile:unknown, admins:string[], storage:{read:()=>Promise<Store>;add:(person:Person)=>Promise<unknown>}) {
  const login=verifiedGoogleLogin(provider,profile);
  if (!login) return false;
  if (admins.includes(login.email)) return true; // The owner can initialize an empty Sheet.
  const store=await storage.read();
  const person=googleMember(login,store);
  if (!store.people.some(p=>p.id===person.id)) await storage.add(person);
  return true;
}
