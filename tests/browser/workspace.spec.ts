import { expect, test, type Page } from "@playwright/test";
const pageErrors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const errors:string[]=[];pageErrors.set(page,errors);page.on("pageerror",e=>errors.push(e.message));});
test.afterEach(async({page})=>{expect(pageErrors.get(page)).toEqual([]);});
const headers={Origin:"http://localhost:3100"};

test("admin has one overview of people and entries without a setup checklist",async({page})=>{
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"Lab overview",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"People and their work"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"All entries"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Copy invite link"})).toBeVisible();
  await page.context().grantPermissions(["clipboard-read","clipboard-write"]);
  await page.getByRole("button",{name:"Copy invite link"}).click();
  await expect(page.getByRole("status")).toContainText("Link copied");
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe("http://localhost:3100");
  await expect(page.getByRole("button",{name:"Add member",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"2. Assign work",exact:true})).toHaveCount(0);
  await page.getByLabel("Filter by person").selectOption("hars");
  await expect(page.locator(".entries-grid .update-card")).toHaveCount(1);
  await page.getByLabel("Filter by status").selectOption("Blocked");
  await expect(page.locator(".entries-grid")).toContainText("need access");
  await page.locator(".project-directory summary").click();
  await page.locator(".project-directory-list").getByRole("button",{name:"Quantitative Entrepreneurial Ecosystems",exact:false}).click();
  await page.getByRole("button",{name:"Edit project",exact:true}).click();
  await page.getByLabel("Next milestone").fill("Review the pilot dataset");
  await page.getByRole("button",{name:"Save project"}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const workspace=await (await page.request.get("/api/workspace")).json();
  expect(workspace.projects.find((p:{id:string})=>p.id==="P10").milestone).toBe("Review the pilot dataset");
});

test("existing members save and reload their own entries; admin mutations remain protected",async({page})=>{
  await page.goto("/");await page.getByRole("button",{name:"Member view",exact:true}).click();
  await expect(page.getByRole("heading",{name:"My work",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Add entry",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Add entry",exact:true});
  await expect(dialog.getByLabel("Project",{exact:true})).toHaveValue("P10");
  await expect(dialog).toContainText("Previously, you planned to…");
  await dialog.getByLabel("Progress made").fill("Browser test: completed the pilot comparison.");
  await dialog.getByRole("radio",{name:"Blocked",exact:true}).check();
  await dialog.getByLabel("Blockers or help needed").fill("Please review the output.");
  await dialog.getByLabel("Next step").fill("Expand the evaluation set.");
  await dialog.getByRole("button",{name:"Save entry",exact:true}).click();
  await expect(dialog).toHaveCount(0);await expect(page.getByRole("status")).toContainText("Entry saved");
  await expect(page.getByText("Browser test: completed the pilot comparison.",{exact:true})).toBeVisible();
  await page.reload();await expect(page.getByText("Browser test: completed the pilot comparison.",{exact:true})).toBeVisible();
  const workspace=await (await page.request.get("/api/workspace")).json();
  expect(workspace.identity.personId).toBe("hars");expect(workspace.updates.every((u:{personId:string})=>u.personId==="hars")).toBeTruthy();
  expect((await page.request.patch("/api/projects",{headers,data:workspace.projects[0]})).status()).toBe(403);
  expect((await page.request.post("/api/people",{headers,data:{name:"Fake",email:"fake@example.com",role:"admin"}})).status()).toBe(403);
  expect((await page.request.get("/api/member-preview?personId=hars")).status()).toBe(403);
  expect((await page.request.post("/api/entries",{headers:{Origin:"https://other.example.com"},data:{}})).status()).toBe(403);
  expect((await page.request.post("/api/entries",{headers,data:{entryId:crypto.randomUUID(),projectId:"P10",assignmentId:"A014",progress:"Impersonation",status:"On track"}})).status()).toBe(403);
});

test("a new account joins and posts to an existing project without admin setup",async({page})=>{
  await page.goto("/");await page.getByRole("button",{name:"New member view",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Welcome, New sample member."})).toBeVisible();
  const before=await (await page.request.get("/api/workspace")).json();
  expect(before.identity.role).toBe("member");expect(before.people.map((p:{id:string})=>p.id)).toEqual([before.identity.personId]);expect(before.assignments).toHaveLength(0);expect(before.availableProjects.length).toBeGreaterThanOrEqual(15);
  await page.getByRole("button",{name:"Add your first entry"}).click();
  const dialog=page.getByRole("dialog",{name:"Add entry",exact:true});
  await dialog.getByLabel("Project",{exact:true}).selectOption("P01");
  await dialog.getByLabel("Progress made").fill("New member: reviewed the templates.");
  await dialog.getByRole("button",{name:"Save entry"}).click();await expect(dialog).toHaveCount(0);
  await expect(page.getByText("New member: reviewed the templates.",{exact:true})).toBeVisible();
  const after=await (await page.request.get("/api/workspace")).json();
  expect(after.identity.personId).toBe(before.identity.personId);expect(after.assignments).toHaveLength(1);expect(after.assignments[0].personId).toBe(before.identity.personId);
  expect(after.projects.map((p:{id:string})=>p.id)).toEqual(["P01"]);expect(after.updates).toHaveLength(1);
  await page.getByRole("button",{name:"Admin view",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Lab overview"})).toBeVisible();
  await expect(page.getByText(before.identity.email,{exact:true})).toBeVisible();
  await expect(page.getByText("New member: reviewed the templates.",{exact:true})).toBeVisible();
});

test("a new member creates their own project, then adds another entry without duplicating it",async({page})=>{
  await page.goto("/");await page.getByRole("button",{name:"New member view",exact:true}).click();
  await page.getByRole("button",{name:"Add your first entry"}).click();
  let dialog=page.getByRole("dialog",{name:"Add entry",exact:true});
  await dialog.getByLabel("Project",{exact:true}).selectOption("new");await dialog.getByLabel("Project name").fill("Self-service prototype");
  await dialog.getByLabel("Progress made").fill("Created the first prototype.");await dialog.getByRole("button",{name:"Save entry"}).click();await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading",{name:"Self-service prototype",exact:true})).toBeVisible();
  const first=await (await page.request.get("/api/workspace")).json();expect(first.projects).toHaveLength(1);expect(first.assignments).toHaveLength(1);
  await page.getByRole("button",{name:"Add entry for Self-service prototype Project work",exact:true}).click();
  dialog=page.getByRole("dialog",{name:"Add entry",exact:true});
  await expect(dialog.getByLabel("Project",{exact:true})).toHaveValue(first.projects[0].id);
  await dialog.getByLabel("Progress made").fill("Improved the prototype.");await dialog.getByRole("button",{name:"Save entry"}).click();await expect(dialog).toHaveCount(0);
  const second=await (await page.request.get("/api/workspace")).json();expect(second.projects).toHaveLength(1);expect(second.assignments).toHaveLength(1);expect(second.updates).toHaveLength(2);
  await page.reload();await expect(page.getByText("Improved the prototype.",{exact:true})).toBeVisible();
});

test("admin can correct roles and preview a member without changing their signed-in identity",async({page})=>{
  await page.goto("/");await page.getByRole("button",{name:"Edit Lin",exact:true}).click();
  await page.getByLabel("Google account email").fill("lin-test@example.com");await page.getByLabel("Role",{exact:true}).selectOption("admin");await page.getByRole("button",{name:"Save member"}).click();
  await expect(page.getByRole("button",{name:"Preview Lin",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Edit Harsimran",exact:true}).click();await expect(page.getByLabel("Role",{exact:true})).toBeDisabled();await page.getByRole("button",{name:"Cancel",exact:true}).click();
  expect((await page.request.patch("/api/people",{headers,data:{id:"harsimran",name:"Harsimran",email:"harsimran1869@gmail.com",affiliation:"",role:"member"}})).status()).toBe(400);
  await page.getByRole("button",{name:"Preview Hars",exact:true}).click();await expect(page.getByRole("region",{name:"Member preview"})).toBeVisible();
  await page.getByRole("button",{name:"Add entry",exact:true}).click();await expect(page.getByRole("button",{name:"Saving disabled in preview"})).toBeDisabled();
  await page.getByRole("button",{name:"Cancel",exact:true}).click();await page.getByRole("button",{name:"Refresh workspace"}).click();
  await expect(page.getByRole("region",{name:"Member preview"})).toBeVisible();
  expect((await (await page.request.get("/api/workspace")).json()).identity.role).toBe("admin");
  await page.getByRole("button",{name:"Return to admin"}).click();await expect(page.getByRole("heading",{name:"Lab overview",exact:true})).toBeVisible();
});

test("self-service entry creation fits a mobile screen",async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto("/");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await page.getByRole("button",{name:"New member view",exact:true}).click();await page.getByRole("button",{name:"Add your first entry"}).click();
  await page.getByLabel("Project",{exact:true}).selectOption("new");await page.getByLabel("Project name").fill("Mobile project");await page.getByLabel("Progress made").fill("Added from a mobile screen.");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await page.getByRole("button",{name:"Save entry"}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Added from a mobile screen.",{exact:true})).toBeVisible();
});

test("production ignores sample authentication and rejects anonymous entry creation",async({request})=>{
  const html=await request.get("http://localhost:3101/");expect(await html.text()).toContain("Google setup is still needed");
  for(const view of ["admin","member","new","person:anyone"])expect((await request.post("http://localhost:3101/api/demo",{headers:{Origin:"http://localhost:3101"},form:{view}})).status()).toBe(404);
  expect((await request.get("http://localhost:3101/api/workspace")).status()).toBe(401);
  expect((await request.get("http://localhost:3101/api/member-preview?personId=hars")).status()).toBe(401);
  expect((await request.post("http://localhost:3101/api/entries",{headers:{Origin:"http://localhost:3101"},data:{entryId:crypto.randomUUID(),newProjectName:"Anonymous",progress:"Unauthorized",status:"On track"}})).status()).toBe(401);
});
