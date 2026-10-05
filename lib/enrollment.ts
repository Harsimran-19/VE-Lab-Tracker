import { createHash } from "node:crypto";
import { z } from "zod";
import type { Person, Store } from "./types";
const googleProfile = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  email_verified: z.literal(true),
  name: z.string().optional(),
});
export function verifiedGoogleLogin(
  provider: string | undefined,
  profile: unknown,
) {
  if (provider !== "google") return null;
  const result = googleProfile.safeParse(profile);
  return result.success
    ? {
        email: result.data.email,
        name: (result.data.name?.trim() || result.data.email).slice(0, 150),
      }
    : null;
}
export function googleMember(
  login: { email: string; name: string },
  store: Store,
  admins: string[] = [],
): Person {
  return (
    store.people.find((p) => p.email.toLowerCase() === login.email) ?? {
      id: `google-${createHash("sha256").update(login.email).digest("hex").slice(0, 32)}`,
      ...login,
      setupComplete: admins.includes(login.email) ? "true" : "false",
      reminders: "true",
    }
  );
}
export async function enrollGoogleAccount(
  provider: string | undefined,
  profile: unknown,
  admins: string[],
  storage: {
    read: () => Promise<Store>;
    add: (person: Person) => Promise<unknown>;
  },
) {
  const login = verifiedGoogleLogin(provider, profile);
  if (!login) return false;
  const store = await storage.read();
  const person = googleMember(login, store, admins);
  if (!store.people.some((p) => p.id === person.id)) await storage.add(person);
  return true;
}
