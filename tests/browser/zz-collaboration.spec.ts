import { test, expect, type APIRequestContext } from "@playwright/test";
const origin="http://localhost:3100";
async function workspace(api:APIRequestContext){return (await api.get("/api/workspace")).json();}
async function write(api:APIRequestContext,path:string,data:object,method="PATCH") {return api.fetch(path,{method,data,headers:{Origin:origin}});}
async function projectVersion(api:APIRequestContext,id:string){return (await workspace(api)).projects.find((p:{id:string})=>p.id===id).version;}

test("project collaboration, reporting, filters, conflict recovery, history and mobile layout",async({page,browser})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:1487,height:1058});
  await page.goto("/projects");
  await page.request.post("/api/demo",{form:{view:"admin"},headers:{Origin:origin}});
  let folderId="";
  const id=crypto.randomUUID(),longName=`Collaboration verification ${"X".repeat(110)}`;
  expect((await write(page.request,"/api/projects",{id,name:longName,goal:"Preserve the current tracker",type:"Research"},"POST")).ok()).toBeTruthy();
  const initial=await workspace(page.request),adminId=initial.identity.personId;
  expect((await write(page.request,"/api/project-team",{projectId:id,action:"responsibilities",personId:adminId,contributor:true,supervisor:true,expectedVersion:await projectVersion(page.request,id)})).ok()).toBeTruthy();
  const contributorContext=await browser.newContext(),supervisorContext=await browser.newContext();
  const contributor=await contributorContext.newPage(),supervisor=await supervisorContext.newPage();
  await contributor.setViewportSize({width:1487,height:1058});
  for(const [person,name] of [[contributor,"Contributor with a long name for responsive verification"],[supervisor,"Supervisor with a long name for responsive verification"]] as const) {
    await person.goto("/");expect((await person.request.post("/api/demo",{form:{view:"new"},headers:{Origin:origin}})).ok()).toBeTruthy();
    expect((await write(person.request,"/api/onboarding",{name,projectIds:[]},"POST")).ok()).toBeTruthy();
  }
  const contributorId=(await workspace(contributor.request)).identity.personId,supervisorId=(await workspace(supervisor.request)).identity.personId;
  for(const [personId,isSupervisor] of [[contributorId,false],[supervisorId,true]] as const) expect((await write(page.request,"/api/project-team",{projectId:id,action:"add",personId,contributor:!isSupervisor,supervisor:isSupervisor,expectedVersion:await projectVersion(page.request,id)})).ok()).toBeTruthy();
  expect((await write(contributor.request,"/api/project-team",{projectId:id,action:"lead",personId:contributorId,expectedVersion:await projectVersion(page.request,id)})).status()).toBe(403);
  expect((await write(supervisor.request,"/api/project-team",{projectId:id,action:"reporting",researcherId:contributorId,supervisorIds:[supervisorId,adminId],expectedVersion:await projectVersion(page.request,id)})).ok()).toBeTruthy();
  await page.goto(`/projects/${id}`);await page.getByRole("tab",{name:"People",exact:true}).click();
  await expect(page.getByRole("table")).toContainText("Supervisor with a long name");
  await expect(page.locator(".project-lead-line")).toContainText(initial.identity.name);
  await expect(page.locator(".project-lead-line")).toContainText("Supervisor with a long name");
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:"/tmp/ve-after-mobile-long-names.png",fullPage:true});await page.setViewportSize({width:1487,height:1058});
  await page.getByRole("button",{name:"Edit Contributor with a long name for responsive verification",exact:true}).click();
  let dialog=page.getByRole("dialog");await expect(dialog.getByRole("checkbox",{name:"Researcher",exact:true})).toBeVisible();await dialog.getByRole("button",{name:"Cancel",exact:true}).click();
  await page.goto("/projects");await page.getByText("Folders",{exact:true}).click();await page.getByRole("button",{name:"Create folder",exact:true}).click();dialog=page.getByRole("dialog");await dialog.getByLabel("Folder name",{exact:true}).fill("Related verification projects");await dialog.getByLabel("Description",{exact:false}).fill("Existing project identities");await dialog.getByRole("button",{name:"Save folder",exact:true}).click();await expect(dialog).toHaveCount(0);folderId=(await workspace(page.request)).folders.find((f:{name:string})=>f.name==="Related verification projects").id;
  await supervisor.goto(`/projects/${id}`);await supervisor.getByRole("button",{name:"Change type or folder",exact:true}).click();dialog=supervisor.getByRole("dialog");await dialog.getByLabel("Project type",{exact:true}).selectOption("Lab Management");await dialog.getByLabel("Folder",{exact:true}).selectOption(folderId);await dialog.getByRole("button",{name:"Save project",exact:true}).click();await expect(dialog).toHaveCount(0);
  await page.goto("/projects");await page.getByLabel("Project type",{exact:true}).selectOption("Lab Management");await page.getByLabel("Folder",{exact:true}).selectOption(folderId);await page.getByLabel("Search projects").fill("Collaboration verification");
  await expect(page.getByRole("table")).toContainText(longName);await expect(page.getByRole("table")).toContainText("Supervisor with a long name");await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.setViewportSize({width:1487,height:1058});
  await page.screenshot({path:"/tmp/ve-after-projects.png",fullPage:true});
  await contributor.goto(`/projects/${id}`);await contributor.getByRole("button",{name:"Project settings",exact:true}).click();dialog=contributor.getByRole("dialog");await dialog.getByLabel("Project name",{exact:true}).fill("My unsaved collaboration name");
  const before=await projectVersion(page.request,id);
  expect((await write(supervisor.request,"/api/projects",{id,action:"goal",name:"Supervisor’s newer name",goal:"Updated goal",expectedVersion:before})).ok()).toBeTruthy();
  await dialog.getByRole("button",{name:"Save project",exact:true}).click();await expect(dialog.getByRole("alert")).toContainText("latest version");await expect(dialog.getByLabel("Project name",{exact:true})).toHaveValue("My unsaved collaboration name");
  await dialog.getByRole("button",{name:"Review latest version",exact:true}).click();await expect(dialog.locator("strong").filter({hasText:"Supervisor’s newer name"})).toBeVisible();await dialog.getByRole("button",{name:"Use reviewed version and keep my input",exact:true}).click();await dialog.getByRole("button",{name:"Save project",exact:true}).click();await expect(dialog).toHaveCount(0);
  await expect(contributor.getByRole("heading",{name:"My unsaved collaboration name",exact:true})).toBeVisible();
  await contributor.getByRole("tab",{name:"Activity",exact:true}).click();await expect(contributor.getByRole("heading",{name:"Activity history"})).toBeVisible();await expect(contributor.locator(".update-card").first()).toContainText("Contributor with a long name");await contributor.locator(".update-card").first().getByText("View changes",{exact:true}).click();await expect(contributor.locator(".update-card").first()).toContainText("Supervisor’s newer name");
  await contributor.screenshot({path:"/tmp/ve-after-activity.png",fullPage:true});
  await page.goto(`/projects/${id}`);await page.getByRole("tab",{name:"People",exact:true}).click();await page.screenshot({path:"/tmp/ve-after-people.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:"/tmp/ve-after-mobile-people.png",fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("button",{name:"Edit Contributor with a long name for responsive verification",exact:true}).click();dialog=page.getByRole("dialog");await dialog.getByRole("button",{name:"Remove member",exact:true}).click();await expect(dialog).toContainText("reporting relationship");await page.screenshot({path:"/tmp/ve-after-mobile-dialog.png",fullPage:true});await dialog.getByRole("button",{name:"Confirm removal",exact:true}).click();await expect(dialog).toHaveCount(0);
  expect((await write(contributor.request,"/api/projects",{id,action:"goal",name:"Removed member write",goal:"Denied",expectedVersion:await projectVersion(page.request,id)})).status()).toBe(403);
  await page.goto("/projects");await page.getByText("Folders",{exact:true}).click();await page.getByRole("button",{name:"Edit folder Related verification projects",exact:true}).click();dialog=page.getByRole("dialog");await dialog.getByRole("button",{name:"Remove folder",exact:true}).click();await expect(dialog).toContainText("project will become ungrouped");await dialog.getByRole("button",{name:"Confirm removal",exact:true}).click();await expect(dialog).toHaveCount(0);
  const saved=(await workspace(page.request)).projects.find((p:{id:string})=>p.id===id);expect(saved.id).toBe(id);expect(saved.folderId).toBe("");expect(saved.phase).toBe("Idea");
  await page.goto(`/projects/${id}`);await page.getByRole("tab",{name:"Overview",exact:true}).waitFor();await page.screenshot({path:"/tmp/ve-after-mobile-detail.png",fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await contributorContext.close();await supervisorContext.close();
});

test("non-research creation starts without a research phase; keyboard tabs and viewer denial remain clear",async({page})=>{
  await page.goto("/projects");const dialogOpen=page.getByRole("button",{name:"New project",exact:true});await dialogOpen.click();const dialog=page.getByRole("dialog",{name:"Create project"});await dialog.getByLabel("Project type",{exact:true}).selectOption("Startup");await expect(dialog.getByLabel("Current phase",{exact:true})).toHaveValue("");await dialog.getByLabel("Project name",{exact:true}).fill("Startup verification");await dialog.getByLabel("Goal",{exact:true}).fill("Build a prototype");await dialog.getByRole("button",{name:"Create project",exact:true}).click();await expect(dialog).toHaveCount(0);await page.getByRole("link",{name:"Startup verification",exact:true}).click();const tab=page.getByRole("tab",{name:"Overview",exact:true});await tab.focus();await page.keyboard.press("End");await expect(page.getByRole("tab",{name:"Activity",exact:true})).toBeFocused();await expect(page.getByRole("tab",{name:"Activity",exact:true})).toHaveAttribute("aria-selected","true");await page.setViewportSize({width:1487,height:1058});await page.getByRole("tab",{name:"Overview",exact:true}).click();await page.screenshot({path:"/tmp/ve-after-detail.png",fullPage:true});
});

test("existing responsibilities, resources, weekly reports and audited report conflicts remain usable",async({page,browser})=>{
  test.setTimeout(90000);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/projects");const id=crypto.randomUUID(),streamId=crypto.randomUUID();
  expect((await write(page.request,"/api/projects",{id,name:"Progress integration",goal:"Keep existing features usable"},"POST")).ok()).toBeTruthy();
  const context=await browser.newContext(),person=await context.newPage();person.on("pageerror",e=>errors.push(e.message));await person.goto("/");await person.request.post("/api/demo",{form:{view:"new"},headers:{Origin:origin}});expect((await write(person.request,"/api/onboarding",{name:"Progress contributor",projectIds:[id]},"POST")).ok()).toBeTruthy();const personId=(await workspace(person.request)).identity.personId;
  expect((await write(page.request,"/api/workstreams",{projectId:id,action:"save",workstream:{id:streamId,name:"Integration responsibility",ownerId:personId,status:"In progress",due:"",notes:"Existing work"},expectedVersion:await projectVersion(page.request,id)})).ok()).toBeTruthy();
  await person.goto(`/projects/${id}`);await person.getByLabel("Status for Integration responsibility",{exact:true}).selectOption("Blocked");await expect(person.getByRole("status")).toContainText("Responsibility updated");
  await person.getByRole("button",{name:"Write weekly update",exact:true}).click();let dialog=person.getByRole("dialog");await dialog.getByText("Which responsibilities does this cover?",{exact:false}).click();await dialog.getByRole("checkbox",{name:"Integration responsibility",exact:true}).check();await dialog.getByLabel("What did you accomplish?",{exact:true}).fill("Verified existing reporting");await dialog.getByLabel("What will you do next?",{exact:true}).fill("Review results");await dialog.getByRole("button",{name:"Submit update",exact:true}).click();await expect(dialog).toHaveCount(0);
  const stored=await workspace(person.request),report=stored.updates.find((u:{projectId:string})=>u.projectId===id);expect(report.personId).toBe(personId);expect(report.workstreams[0].name).toBe("Integration responsibility");
  const body={projectId:id,weekStart:stored.weekStart,progress:"First competing report save",nextPlan:"Review results",needsHelp:false,blockers:"",workstreamIds:[streamId],expectedVersion:report.version};expect((await write(person.request,"/api/entries",body,"POST")).ok()).toBeTruthy();expect((await write(person.request,"/api/entries",{...body,progress:"Stale competing save"},"POST")).status()).toBe(409);
  const latest=await workspace(person.request),saved=latest.updates.find((u:{id:string})=>u.id===report.id);expect(saved.progress).toBe(body.progress);const count=latest.activities.filter((a:{projectId:string})=>a.projectId===id).length;expect((await write(person.request,"/api/entries",{...body,expectedVersion:saved.version},"POST")).ok()).toBeTruthy();expect((await workspace(person.request)).activities.filter((a:{projectId:string})=>a.projectId===id)).toHaveLength(count);
  await person.reload();await person.getByRole("tab",{name:"Resources",exact:true}).click();await person.getByRole("button",{name:"Edit project details",exact:true}).click();dialog=person.getByRole("dialog");await dialog.getByLabel("Project notes",{exact:true}).fill("Resource context preserved");await dialog.getByRole("button",{name:"Save changes",exact:true}).click();await expect(dialog).toHaveCount(0);await expect(person.getByText("Resource context preserved",{exact:true})).toBeVisible();
  const viewer=await context.newPage();await viewer.goto("/");await viewer.request.post("/api/demo",{form:{view:"new"},headers:{Origin:origin}});await write(viewer.request,"/api/onboarding",{name:"Read-only viewer",projectIds:[]},"POST");expect((await write(viewer.request,"/api/projects",{id,action:"goal",name:"Viewer write",goal:"Denied",expectedVersion:await projectVersion(page.request,id)})).status()).toBe(403);expect((await viewer.request.get(`/api/activity?projectId=${id}`)).ok()).toBeTruthy();
  expect(errors).toEqual([]);await context.close();
});
