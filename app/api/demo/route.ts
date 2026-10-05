import { NextResponse } from "next/server";
import { isDemo, adminEmails } from "@/lib/config";
import { requireSameOrigin } from "@/lib/access";
import { apiError } from "@/lib/api";
import { addPerson, readStore } from "@/lib/store";
import { googleMember } from "@/lib/enrollment";
export async function POST(request: Request) {
  if (!isDemo())
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    requireSameOrigin(request);
    const form = await request.formData(),
      view = String(form.get("view") ?? "admin");
    let cookie = "admin";
    if (view === "new" || view === "member") {
      const email =
        view === "new"
          ? `sample-${crypto.randomUUID()}@demo.invalid`
          : "member@demo.invalid";
      const store = await readStore();
      const person = googleMember(
        { email, name: "Test member" },
        store,
        adminEmails(),
      );
      await addPerson(person);
      cookie = `person:${person.id}`;
    }
    const response = NextResponse.redirect(
      new URL("/", process.env.NEXTAUTH_URL || request.url),
      303,
    );
    response.cookies.set("ve-demo-view", cookie, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
    });
    return response;
  } catch (e) {
    return apiError(e);
  }
}
