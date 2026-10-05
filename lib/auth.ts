import "server-only";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { cookies } from "next/headers";
import { adminEmails, isDemo } from "./config";
import { AppError, resolveIdentity } from "./access";
import { addPerson, readStore } from "./store";

import { enrollGoogleAccount, googleMember } from "./enrollment";
import type { Identity, Store } from "./types";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/", error: "/" },
  callbacks: {
    async signIn({ account, profile }) {
      try {
        return await enrollGoogleAccount(
          account?.provider,
          profile,
          adminEmails(),
          { read: readStore, add: addPerson },
        );
      } catch {
        return false;
      }
    },
    async session({ session, token }) {
      if (session.user) session.user.email = token.email ?? null;
      return session;
    },
  },
};
export async function loginIdentity(): Promise<{
  email: string;
  name: string;
} | null> {
  if (isDemo()) {
    const view = (await cookies()).get("ve-demo-view")?.value;
    if (view?.startsWith("person:")) {
      const person = (await readStore()).people.find(
        (p) => p.id === view.slice(7),
      );
      if (person?.email) return { email: person.email, name: person.name };
    }
    return { email: "harsimran1869@gmail.com", name: "Harsimran" };
  }
  const session = await getServerSession(authOptions);
  return session?.user?.email
    ? { email: session.user.email, name: session.user.name || "Lab member" }
    : null;
}
export async function authorizedContext(): Promise<{
  identity: Identity;
  store: Store;
}> {
  const login = await loginIdentity();
  if (!login) throw new AppError("Please sign in with Google.", 401);
  let store = await readStore();
  const admins = adminEmails();
  if (
    !store.people.some(
      (p) => p.email.toLowerCase() === login.email.toLowerCase(),
    )
  ) {
    const person = googleMember(
      { email: login.email.toLowerCase(), name: login.name },
      store,
      admins,
    );
    await addPerson(person);
    store = await readStore();
  }
  return {
    store,
    identity: resolveIdentity(login.email, login.name, store, admins),
  };
}
