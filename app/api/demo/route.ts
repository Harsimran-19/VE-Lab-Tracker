import { NextResponse } from "next/server";
import { isDemo } from "@/lib/config";
import { requireSameOrigin } from "@/lib/access";
import { addPerson, readStore } from "@/lib/store";
import { enrollGoogleAccount } from "@/lib/enrollment";
import { apiError } from "@/lib/api";
export async function POST(request: Request) {
  if (!isDemo()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    requireSameOrigin(request);
    const form = await request.formData();
    let requested=String(form.get("view")??"admin");
    if(requested==="new"){
      const email=`sample-${crypto.randomUUID()}@demo.invalid`;
      await enrollGoogleAccount("google",{email,name:"New sample member",email_verified:true},[],{read:readStore,add:addPerson});
      const person=(await readStore()).people.find(p=>p.email===email)!;
      requested=`person:${person.id}`;
    }
    const personId=requested.startsWith("person:")?requested.slice(7):"";
    if(personId && !(await readStore()).people.some(p=>p.id===personId&&p.email)) return NextResponse.json({error:"Sample person not found"},{status:404});
    const view=personId?requested:requested==="member"?"member":"admin";
    const response = NextResponse.redirect(new URL("/", process.env.NEXTAUTH_URL || request.url), 303);
    response.cookies.set("ve-demo-view", view, { httpOnly: true, sameSite: "strict", path: "/" });
    return response;
  } catch (e) { return apiError(e); }
}
