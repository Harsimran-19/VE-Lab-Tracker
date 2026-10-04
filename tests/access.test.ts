import test from "node:test";
import assert from "node:assert/strict";
import { AppError, requireAdmin, requireAssignment, requireSameOrigin, resolveIdentity, scopeStore } from "../lib/access";
import { isDemo } from "../lib/config";
import { assignmentSchema, personSchema, projectSchema, reportSchema } from "../lib/schema";
import { latestByAssignment } from "../lib/format";
import seed from "../lib/seed.json";
import type { Store } from "../lib/types";

function fixture(): Store {
  const data = structuredClone(seed) as Store;
  data.people.find(p => p.id === "hars")!.email = "member@example.com";
  return data;
}
test("an admin can sign in before spreadsheet initialization", () => {
  const identity = resolveIdentity("Harsimran1869@Gmail.com", "Harsimran", { projects: [], people: [], assignments: [], updates: [], collaborators: [] }, ["harsimran1869@gmail.com"]);
  assert.equal(identity.role, "admin");
});
test("unknown accounts are refused and matched members receive their own identity", () => {
  assert.throws(() => resolveIdentity("outsider@example.com", "Outsider", fixture(), []), (e:unknown) => e instanceof AppError && e.status === 403);
  const identity = resolveIdentity(" MEMBER@example.com ", "Google display name", fixture(), []);
  assert.equal(identity.personId, "hars"); assert.equal(identity.role, "member"); assert.equal(identity.name, "Hars");
});
test("member data includes only their assigned projects and their own reports", () => {
  const store = fixture();
  store.updates = [
    { id: "1", createdAt: "2026-10-01T12:00:00Z", projectId: "P10", assignmentId: "A016", personId: "hars", progress: "My work", blockers: "", nextPlan: "", status: "On track" },
    { id: "2", createdAt: "2026-10-01T12:00:00Z", projectId: "P10", assignmentId: "A014", personId: "mindy", progress: "Someone else's work", blockers: "", nextPlan: "", status: "On track" }
  ];
  const identity = resolveIdentity("member@example.com", "", store, []);
  const scoped = scopeStore(store, identity);
  assert.deepEqual(scoped.projects.map(p => p.id), ["P10"]);
  assert.deepEqual(scoped.assignments.map(a => a.id), ["A016"]);
  assert.deepEqual(scoped.updates.map(u => u.id), ["1"]);
  assert.ok(scoped.collaborators.every(c => c.projectId === "P10"));
  assert.equal(scoped.people.length, store.people.length);
});
test("members cannot edit admin data or report another person's responsibility", () => {
  const data=fixture();const identity=resolveIdentity("member@example.com","",data,[]);
  assert.throws(()=>requireAdmin(identity),AppError);
  assert.throws(()=>requireAssignment(data,identity,"A014"),AppError);
  assert.throws(()=>requireAssignment(data,identity,"not-real"),AppError);
  assert.equal(requireAssignment(data,identity,"A016").projectId,"P10");
});
test("sample authentication is disabled in production and on Vercel", () => {
  assert.equal(isDemo({NODE_ENV:"production",DEMO_MODE:"true"}),false);
  assert.equal(isDemo({NODE_ENV:"development",DEMO_MODE:"true",VERCEL:"1"}),false);
  assert.equal(isDemo({NODE_ENV:"development",DEMO_MODE:"true"}),true);
  assert.equal(isDemo({NODE_ENV:"development",DEMO_MODE:"false"}),false);
});
test("cross-origin writes are rejected",()=>{
  const original=process.env.NEXTAUTH_URL;process.env.NEXTAUTH_URL="https://lab.example.com";
  try {
    assert.throws(()=>requireSameOrigin(new Request("https://lab.example.com/api/updates",{headers:{origin:"https://other.example.com"}})),AppError);
    assert.throws(()=>requireSameOrigin(new Request("https://lab.example.com/api/updates")),AppError);
    requireSameOrigin(new Request("https://lab.example.com/api/updates",{headers:{origin:"https://lab.example.com"}}));
  } finally { if(original===undefined)delete process.env.NEXTAUTH_URL;else process.env.NEXTAUTH_URL=original; }
});
test("reports reject blank progress, spoofed authors, unknown statuses, and oversized input",()=>{
  const valid={assignmentId:"A016",progress:"Reviewed two papers",blockers:"",nextPlan:"",status:"On track"};
  assert.equal(reportSchema.safeParse(valid).success,true);
  assert.equal(reportSchema.safeParse({...valid,progress:"  "}).success,false);
  assert.equal(reportSchema.safeParse({...valid,personId:"fanny"}).success,false);
  assert.equal(reportSchema.safeParse({...valid,status:"Anything"}).success,false);
  assert.equal(reportSchema.safeParse({...valid,progress:"x".repeat(4001)}).success,false);
});
test("admin forms reject invalid dates, roles, and email addresses",()=>{
  assert.equal(projectSchema.safeParse({...seed.projects[0],due:"2026-02-30"}).success,false);
  assert.equal(projectSchema.safeParse(seed.projects[0]).success,true);
  assert.equal(personSchema.safeParse({id:"hars",name:"Hars",email:"invalid",affiliation:""}).success,false);
  assert.equal(personSchema.safeParse({id:"hars",name:"Hars",email:"test@example.com",affiliation:"",role:"admin"}).success,false);
  assert.equal(assignmentSchema.safeParse({...seed.assignments[0],due:"not-a-date"}).success,false);
});
test("newer reports resolve old blockers in the dashboard",()=>{
  const base={projectId:"P10",assignmentId:"A016",personId:"hars",progress:"Work",nextPlan:""};
  const rows=[{...base,id:"old",createdAt:"2026-10-01T00:00:00Z",blockers:"Need access",status:"Blocked"},{...base,id:"new",createdAt:"2026-10-02T00:00:00Z",blockers:"",status:"On track"}];
  const latest=latestByAssignment(rows);assert.equal(latest.length,1);assert.equal(latest[0].id,"new");assert.equal(latest[0].blockers,"");
});
