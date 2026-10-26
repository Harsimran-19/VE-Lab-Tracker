import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fixture, manager, member, now } from "./fixture";
import { checkVersion, planTeamChange, planFolderChange, upgradeStore, recordChanges, versionedInput } from "../lib/collaboration";
import { planProjectChange, planProjectCreation, planWorkstreamChange } from "../lib/project-details";
import { planEntry } from "../lib/entries";
import { canManageProject, workspaceFor } from "../lib/access";
import { mutateProjectDomain, readStore } from "../lib/store";
import type { Store, Identity } from "../lib/types";
const previousEnv = {NODE_ENV:process.env.NODE_ENV,DEMO_MODE:process.env.DEMO_MODE,ADMIN_EMAILS:process.env.ADMIN_EMAILS,VERCEL:process.env.VERCEL};
const shared = globalThis as typeof globalThis & {veLabFreshDemo?:Store};
const supervisor:Identity={personId:"supervisor",name:"Supervisor",email:"supervisor@example.com",role:"member"};
const viewer:Identity={personId:"viewer",name:"Viewer",email:"viewer@example.com",role:"member"};
function teamStore() {
  const s=upgradeStore(fixture());
  s.people.push({id:supervisor.personId,email:supervisor.email,name:supervisor.name,setupComplete:"true",reminders:"true"},{id:viewer.personId,email:viewer.email,name:viewer.name,setupComplete:"true",reminders:"true"});
  s.projects[0].leadId=manager.personId;
  s.memberships.push({id:"lead",personId:manager.personId,projectId:s.projects[0].id,joinedAt:now.toISOString(),contributor:true,supervisor:false},{id:"supervisor",personId:supervisor.personId,projectId:s.projects[0].id,joinedAt:now.toISOString(),contributor:false,supervisor:true});
  return s;
}
beforeEach(()=>{Object.assign(process.env,{NODE_ENV:"development",DEMO_MODE:"true",VERCEL:"",ADMIN_EMAILS:manager.email});shared.veLabFreshDemo=teamStore();});
after(()=>{for(const [k,v] of Object.entries(previousEnv)) if(v===undefined)delete process.env[k];else process.env[k]=v;delete shared.veLabFreshDemo;});
function goal(s:Store,name="Changed") {return {id:s.projects[0].id,action:"goal",name,goal:"Updated goal"};}
function teamInput(s:Store,action:string,extra:object) {return {projectId:s.projects[0].id,action,...extra};}
async function saveGoal(identity:Identity,version:number,name:string) {
  return mutateProjectDomain(identity,"Project","Updated project",(s,current)=>{const p=planProjectChange(s,current,goal(s,name));checkVersion(p.version,version);s.projects[0]=p;return p;});
}
test("current assigned contributors edit details, while viewers and other-lab identities cannot",async()=>{
  await saveGoal(member,0,"Contributor edit");
  assert.equal((await readStore()).projects[0].name,"Contributor edit");
  await assert.rejects(saveGoal(viewer,1,"Viewer edit"),/Join this project/);
  await assert.rejects(saveGoal({...member,personId:"outside",email:"outside@example.com"},1,"Outside"),/Sign out/);
  await assert.rejects(saveGoal({...viewer,role:"admin"},1,"Forged role"),/Join this project/);
  assert.equal((await readStore()).activities.length,1);
});
test("lead, supervisor and existing administrator manage only eligible project members",()=>{
  const s=teamStore();
  assert.throws(()=>planTeamChange(s,member,teamInput(s,"add",{personId:viewer.personId,contributor:true,supervisor:false})),/project lead/);
  for(const actor of [manager,{...manager,role:"member" as const},supervisor]){
    const copy=structuredClone(s);
    planTeamChange(copy,actor,teamInput(copy,"add",{personId:viewer.personId,contributor:true,supervisor:true}));
    assert.equal(copy.memberships.find(m=>m.personId===viewer.personId)?.supervisor,true);
    assert.equal(copy.people.find(p=>p.id===viewer.personId)?.email,viewer.email);
  }
  assert.throws(()=>planTeamChange(s,supervisor,teamInput(s,"add",{personId:"outside",contributor:true,supervisor:true})),/from this lab/);
  assert.throws(()=>planTeamChange(s,manager,teamInput(s,"add",{personId:member.personId,contributor:true,supervisor:false})),/already belongs/);
});
test("project responsibility and visibility never grant editing of another project",()=>{
  const s=teamStore();s.projects.push({...s.projects[0],id:"other",leadId:""});
  assert.equal(canManageProject(s,supervisor,s.projects[1]),false);
  assert.throws(()=>planProjectChange(s,supervisor,{id:"other",action:"goal",name:"Bad",goal:"Bad"}),/Join this project/);
  assert.equal(workspaceFor(s,viewer,false,now).projects.length,2);
  assert.equal(workspaceFor(s,viewer,false,now).activities.length,0);
});
test("reporting relationships allow multiple supervisors and reject duplicate, self and cross-project targets",()=>{
  const s=teamStore();planTeamChange(s,manager,teamInput(s,"responsibilities",{personId:manager.personId,contributor:true,supervisor:true}));
  planTeamChange(s,manager,teamInput(s,"reporting",{researcherId:member.personId,supervisorIds:[manager.personId,supervisor.personId]}));
  assert.equal(s.projects[0].reporting?.length,2);
  for(const ids of [[supervisor.personId,supervisor.personId],[member.personId],[viewer.personId],["outside"]]) assert.throws(()=>planTeamChange(s,manager,teamInput(s,"reporting",{researcherId:member.personId,supervisorIds:ids})));
  planTeamChange(s,manager,teamInput(s,"responsibilities",{personId:supervisor.personId,contributor:true,supervisor:true}));
  assert.throws(()=>planTeamChange(s,manager,teamInput(s,"reporting",{researcherId:supervisor.personId,supervisorIds:[supervisor.personId]})),/themselves/);
});
test("supervisor responsibility removal cleans dependent links without changing unrelated reports",()=>{
  const s=teamStore();planTeamChange(s,manager,teamInput(s,"reporting",{researcherId:member.personId,supervisorIds:[supervisor.personId]}));
  planTeamChange(s,manager,teamInput(s,"responsibilities",{personId:supervisor.personId,contributor:true,supervisor:false}));
  assert.deepEqual(s.projects[0].reporting,[]);
});
test("removing a lead requires a valid replacement and preserves former-member attribution",async()=>{
  const s=teamStore();assert.throws(()=>planTeamChange(s,manager,teamInput(s,"remove",{personId:manager.personId,replacementLeadId:""})),/replacement lead/);
  await saveGoal(member,0,"Authored by member");
  await mutateProjectDomain(manager,"Project team","Removed member",(s,current)=>planTeamChange(s,current,teamInput(s,"remove",{personId:member.personId,replacementLeadId:""})));
  const latest=await readStore();assert.equal(latest.activities[0].actorName,member.name);
  await assert.rejects(saveGoal(member,latest.projects[0].version!,"Stale open form"),/Join this project/);
  planTeamChange(s,manager,teamInput(s,"remove",{personId:manager.personId,replacementLeadId:supervisor.personId}));
  assert.equal(s.projects[0].leadId,supervisor.personId);
  assert.ok(s.memberships.some(m=>m.personId===s.projects[0].leadId));
});
test("two users cannot overwrite the same initial version and can intentionally recover",async()=>{
  await saveGoal(member,0,"First save");
  await assert.rejects(saveGoal(supervisor,0,"Stale save"),/latest version/);
  const saved=await readStore();assert.equal(saved.projects[0].name,"First save");assert.equal(saved.activities.length,1);
  await saveGoal(supervisor,saved.projects[0].version!,"Reviewed retry");
  assert.equal((await readStore()).projects[0].name,"Reviewed retry");
});
test("success uses the resolved actor and server time; no-ops, denied, malformed and stale writes produce no activity",async()=>{
  const start=Date.now();await saveGoal(member,0,"Update");let s=await readStore();
  assert.equal(s.activities[0].actorId,member.personId);assert.ok(Date.parse(s.activities[0].at)>=start);assert.equal(s.activities[0].changes.find(c=>c.label==="Project name")?.before,"Pilot study");
  await saveGoal(member,1,"Update");assert.equal((await readStore()).activities.length,1);
  assert.throws(()=>versionedInput({id:s.projects[0].id}),/expectedVersion/);
  assert.throws(()=>planProjectChange(s,member,{...goal(s),actorId:manager.personId}));
  await assert.rejects(saveGoal(viewer,1,"Denied"));await assert.rejects(saveGoal(member,0,"Stale"));
  assert.equal((await readStore()).activities.length,1);
});
test("folder assignment and deletion preserve project identity, workflow, team, content and reports",async()=>{
  const id="44444444-4444-4444-8444-444444444444";
  await mutateProjectDomain(manager,"Folder","Created folder",(s,current)=>planFolderChange(s,current,{id,action:"save",name:"Related work",description:""},0));
  await mutateProjectDomain(supervisor,"Project","Moved project",(s,current)=>{const p=planProjectChange(s,current,{id:s.projects[0].id,action:"classification",type:"Lab Management",folderId:id});s.projects[0]=p;});
  let s=await readStore();assert.equal(s.projects[0].phase,"Idea");assert.equal(s.projects[0].id,fixture().projects[0].id);assert.equal(s.memberships.length,3);assert.equal(s.folders[0].version,2);
  assert.throws(()=>planFolderChange(s,member,{id,action:"remove"},2),/Manager access/);
  await mutateProjectDomain(manager,"Folder","Removed folder",(s,current)=>planFolderChange(s,current,{id,action:"remove"},2));
  s=await readStore();assert.equal(s.projects.length,1);assert.equal(s.projects[0].folderId,"");assert.equal(s.projects[0].goal,fixture().projects[0].goal);assert.equal(s.activities.length,2);
});
test("legacy migration backfills only a recorded valid lead and leaves unknown type and assignments unassigned",()=>{
  const raw=fixture();raw.projects[0].leadId=manager.personId;
  const s=upgradeStore(raw);assert.equal(s.projects[0].type,"");assert.equal(s.projects[0].phase,raw.projects[0].phase);assert.equal(s.memberships.find(m=>m.personId===manager.personId)?.joinedAt,"");assert.deepEqual(s.activities,[]);assert.deepEqual(s.projects[0].reporting,[]);
  raw.projects[0].leadId="unknown";assert.equal(upgradeStore(raw).memberships.length,1);
  assert.equal(planProjectCreation(s,manager,{id:"55555555-5555-4555-8555-555555555555",name:"Tool",goal:"Manage equipment",type:"Lab Management"}).phase,"Ideation");
});
test("report edits retain their own integer versions and reject stale progress without altering data",()=>{
  const s=teamStore(),input={projectId:s.projects[0].id,weekStart:"2026-10-05",progress:"First",nextPlan:"Next",needsHelp:false,blockers:""};
  const before=structuredClone(s);const u=planEntry(s,member,input,now);s.updates.push(u);recordChanges(before,s,member,"Weekly update","Saved weekly update",now);assert.equal(u.version,1);
  assert.throws(()=>checkVersion(u.version,0),/latest version/);assert.equal(s.updates[0].progress,"First");
});

test("unknown historical join dates remain usable in reports, reminders and summaries",async()=>{
  const raw=fixture();raw.projects[0].leadId=manager.personId;const s=upgradeStore(raw);
  const {expectedThisWeek}=await import("../lib/calendar");const {planReminders}=await import("../lib/reminders");
  assert.equal(expectedThisWeek(s.memberships.find(m=>m.personId===manager.personId)!,s,now),false);
  assert.doesNotThrow(()=>planReminders(s,new Date("2026-10-09T16:00:00Z"),[manager.email],"https://lab.example.com"));
  const before=structuredClone(s);const report=planEntry(s,manager,{projectId:s.projects[0].id,weekStart:"2026-10-05",progress:"Lead report",nextPlan:"Next",needsHelp:false,blockers:""},now);s.updates.push(report);recordChanges(before,s,manager,"Weekly update","Saved weekly update",now);assert.equal(expectedThisWeek(s.memberships.find(m=>m.personId===manager.personId)!,s,now),true);
});
test("removing a member stops their outstanding responsibility reminders without deleting work",async()=>{
  const s=teamStore();s.projects[0].workstreams=[{id:"22222222-2222-4222-8222-222222222222",name:"Owned work",ownerId:member.personId,status:"In progress",due:"2026-10-06",notes:"Preserve"}];
  planTeamChange(s,manager,teamInput(s,"remove",{personId:member.personId,replacementLeadId:""}));
  const {planReminders}=await import("../lib/reminders");assert.equal(planReminders(s,now,[manager.email],"https://lab.example.com").filter(p=>p.reminder.phase.startsWith("responsibility-")).length,0);assert.equal(s.projects[0].workstreams[0].notes,"Preserve");
});
test("legacy phase text survives settings and classification without reinterpretation",()=>{
  const s=teamStore();s.projects[0].phase="Legacy review stage";
  const p=planProjectChange(s,manager,{id:s.projects[0].id,action:"settings",name:s.projects[0].name,goal:s.projects[0].goal,phase:s.projects[0].phase,leadId:s.projects[0].leadId,priority:"",methods:"",milestone:"",due:"",fullTitle:"",publicationStatus:"",targetJournal:"",altJournal:"",targetConference:""});assert.equal(p.phase,"Legacy review stage");
  assert.equal(planProjectChange(s,manager,{id:p.id,action:"classification",type:"Startup",folderId:""}).phase,"Legacy review stage");
});

test("unchanged details, responsibilities, collaborators and reporting links create no misleading history",async()=>{
  const s=teamStore(),p=s.projects[0];
  p.workstreams=[{id:"22222222-2222-4222-8222-222222222222",name:"First responsibility",ownerId:member.personId,status:"In progress",due:"",notes:""},{id:"33333333-3333-4333-8333-333333333333",name:"Second responsibility",ownerId:member.personId,status:"Not started",due:"",notes:""}];
  p.collaborators=[{id:"44444444-4444-4444-8444-444444444444",name:"First contact",affiliation:"",role:"",email:"",contactVia:"",notes:""},{id:"55555555-5555-4555-8555-555555555555",name:"Second contact",affiliation:"",role:"",email:"",contactVia:"",notes:""}];
  p.reporting=[{researcherId:member.personId,supervisorId:supervisor.personId}];shared.veLabFreshDemo=s;
  await mutateProjectDomain(manager,"Project","Updated project",(s,current)=>{s.projects[0]=planProjectChange(s,current,{id:p.id,action:"details",fullTitle:"",leadId:p.leadId,priority:"",methods:"",notes:"",links:[]});});
  await mutateProjectDomain(member,"Responsibilities","Updated responsibility",(s,current)=>{s.projects[0]=planWorkstreamChange(s,current,{projectId:p.id,action:"save",workstream:p.workstreams![0]});});
  await mutateProjectDomain(member,"Project","Updated collaborator",(s,current)=>{s.projects[0]=planProjectChange(s,current,{id:p.id,action:"collaborator",collaborator:p.collaborators![0]});});
  await mutateProjectDomain(supervisor,"Team","Updated reporting",(s,current)=>planTeamChange(s,current,{projectId:p.id,action:"reporting",researcherId:member.personId,supervisorIds:[supervisor.personId]}));
  const saved=await readStore();assert.equal(saved.activities.length,0);assert.equal(saved.projects[0].version,0);assert.equal(saved.projects[0].workstreams?.[0].name,"First responsibility");
});
