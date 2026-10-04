import test from "node:test";
import assert from "node:assert/strict";
import { enrollGoogleAccount, googleMember, verifiedGoogleLogin } from "../lib/enrollment";
import { persistEntry, planEntry } from "../lib/entries";
import { entrySchema } from "../lib/schema";
import { AppError, resolveIdentity, workspaceFor } from "../lib/access";
import type { Identity, Store } from "../lib/types";
import seed from "../lib/seed.json";
const empty=():Store=>({projects:[],people:[],assignments:[],collaborators:[],updates:[]});
const entryId="a2352476-efb8-428a-af65-759243276458";
const input=()=>entrySchema.parse({entryId,newProjectName:"New lab project",progress:"Built a prototype.",status:"On track"});

test("only verified Google profiles can register; supplied roles and IDs are ignored",async()=>{
  const store=empty();const storage={read:async()=>structuredClone(store),add:async(p:Store['people'][number])=>{store.people.push(p);}};
  for(const profile of [{email:"new@example.com",email_verified:false},{email:"new@example.com",email_verified:"true"},{email:"invalid",email_verified:true}]) assert.equal(await enrollGoogleAccount("google",profile,[],storage),false);
  assert.equal(await enrollGoogleAccount("other",{email:"new@example.com",email_verified:true},[],storage),false);
  assert.equal(store.people.length,0);
  assert.equal(await enrollGoogleAccount("google",{email:" NEW@EXAMPLE.COM ",email_verified:true,name:"New person",role:"admin",id:"harsimran"},[],storage),true);
  assert.equal(store.people.length,1);assert.equal(store.people[0].role,"member");assert.equal(store.people[0].email,"new@example.com");assert.notEqual(store.people[0].id,"harsimran");
  await enrollGoogleAccount("google",{email:"new@example.com",email_verified:true,name:"Changed display name"},[],storage);
  assert.equal(store.people.length,1);assert.equal(store.people[0].name,"New person");
});
test("existing Google accounts retain their workbook identity, assignments, and role",async()=>{
  const store=structuredClone(seed) as Store;const existing=store.people.find(p=>p.id==="hars")!;existing.email="known@example.com";existing.role="admin";
  let writes=0;await enrollGoogleAccount("google",{email:existing.email,email_verified:true,name:"Someone else"},[],{read:async()=>store,add:async()=>{writes++;}});
  assert.equal(writes,0);assert.equal(resolveIdentity(existing.email,"",store,[]).personId,"hars");assert.equal(resolveIdentity(existing.email,"",store,[]).role,"admin");
  const fresh=googleMember({email:"different@example.com",name:existing.name},store);
  assert.notEqual(fresh.id,existing.id);assert.equal(fresh.role,"member");
});
test("the configured admin can sign in before Sheets initialization",async()=>{
  const allowed=await enrollGoogleAccount("google",{email:"owner@example.com",email_verified:true},["owner@example.com"],{read:async()=>{throw new Error("Not initialized");},add:async()=>{throw new Error("Do not write yet");}});
  assert.equal(allowed,true);
  assert.equal(verifiedGoogleLogin("google",{email:"owner@example.com",email_verified:false}),null);
});
test("a self-registered member creates a project and entry without any admin assignment",async()=>{
  const store=empty();const person=googleMember({email:"new@example.com",name:"New member"},store);store.people.push(person);
  const identity=resolveIdentity(person.email,"",store,[]);const plan=planEntry(store,identity,input(),"2026-10-04T10:00:00Z");
  assert.equal(identity.role,"member");assert.equal(plan.update.personId,person.id);assert.equal(plan.assignment?.personId,person.id);
  const order:string[]=[];
  await persistEntry(plan,{addProject:async p=>{order.push("project");store.projects.push(p);},addAssignment:async a=>{order.push("work");store.assignments.push(a);},addUpdate:async u=>{order.push("entry");store.updates.push(u);}});
  assert.deepEqual(order,["project","work","entry"]);assert.equal(store.projects[0].name,"New lab project");
  const workspace=workspaceFor(store,identity,false,[]);assert.equal(workspace.projects.length,1);assert.equal(workspace.updates.length,1);
});
test("members can join an existing project while other people's assignments stay protected",()=>{
  const store=structuredClone(seed) as Store;const identity:Identity={email:"new@example.com",name:"New",role:"member",personId:"new-user"};
  const value=entrySchema.parse({...input(),projectId:"P10",newProjectName:""});
  const plan=planEntry(store,identity,value);assert.equal(plan.project,undefined);assert.equal(plan.assignment?.projectId,"P10");assert.equal(plan.update.personId,"new-user");
  assert.throws(()=>planEntry(store,identity,{...value,assignmentId:"A016"}),(e:unknown)=>e instanceof AppError&&e.status===403);
  assert.throws(()=>planEntry(store,identity,{...value,projectId:"missing"}),(e:unknown)=>e instanceof AppError&&e.status===404);
  assert.equal(entrySchema.safeParse({...value,personId:"hars"}).success,false);assert.equal(entrySchema.safeParse({...value,role:"admin"}).success,false);
  assert.equal(entrySchema.safeParse({...value,progress:" "}).success,false);assert.equal(entrySchema.safeParse({...value,entryId:"arbitrary"}).success,false);
});
test("existing responsibilities are reused and cannot be moved to another project",()=>{
  const store=structuredClone(seed) as Store;const identity:Identity={email:"hars@example.com",name:"Hars",role:"member",personId:"hars"};
  const value=entrySchema.parse({...input(),projectId:"P10",newProjectName:""});
  const plan=planEntry(store,identity,value);assert.equal(plan.assignment,undefined);assert.equal(plan.update.assignmentId,"A016");
  assert.throws(()=>planEntry(store,identity,{...value,projectId:"P01",assignmentId:"A016"}),AppError);
});
test("retries recover a partial Sheets write and do not duplicate the saved entry",async()=>{
  const store=empty();const identity:Identity={email:"new@example.com",name:"New",role:"member",personId:"new-user"};let fail=true;
  const storage={addProject:async(p:Store['projects'][number])=>{store.projects.push(p);},addAssignment:async(a:Store['assignments'][number])=>{store.assignments.push(a);},addUpdate:async(u:Store['updates'][number])=>{if(fail)throw new Error("Sheet unavailable");store.updates.push(u);}};
  await assert.rejects(persistEntry(planEntry(store,identity,input()),storage));assert.equal(store.projects.length,1);assert.equal(store.assignments.length,1);
  fail=false;await persistEntry(planEntry(store,identity,input()),storage);await persistEntry(planEntry(store,identity,input()),storage);
  assert.equal(store.projects.length,1);assert.equal(store.assignments.length,1);assert.equal(store.updates.length,1);
  assert.throws(()=>planEntry(store,{...identity,personId:"someone-else"},input()),(e:unknown)=>e instanceof AppError&&e.status===403);
});
test("new members can discover project names without receiving other members' reports",()=>{
  const store=structuredClone(seed) as Store;const identity:Identity={email:"new@example.com",name:"New",role:"member",personId:"new-user"};
  const workspace=workspaceFor(store,identity,false,[]);assert.equal(workspace.projects.length,0);assert.equal(workspace.updates.length,0);assert.equal(workspace.availableProjects.length,15);
  assert.deepEqual(Object.keys(workspace.availableProjects[0]).sort(),["id","name"]);
});
