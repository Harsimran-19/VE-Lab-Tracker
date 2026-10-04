import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { entrySchema } from "@/lib/schema";
import { persistEntry, planEntry } from "@/lib/entries";
import { addProject, addUpdate, saveAssignment } from "@/lib/store";

export async function POST(request:Request){
  try{
    requireSameOrigin(request);
    const {identity,store}=await authorizedContext();
    const input=entrySchema.parse(await readJson(request));
    const plan=planEntry(store,identity,input);
    await persistEntry(plan,{addProject,addAssignment:a=>saveAssignment(a,false),addUpdate});
    return NextResponse.json({update:plan.update},{status:plan.alreadySaved?200:201});
  }catch(error){return apiError(error);}
}
