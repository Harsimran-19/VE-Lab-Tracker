import { expect, test } from "@playwright/test";

test("admin can filter projects, edit a milestone, and manage responsibilities", async({page})=>{
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"The lab, at a glance."})).toBeVisible();
  await page.getByRole("button",{name:"Projects 15",exact:true}).click();
  await page.getByRole("textbox",{name:"Search projects"}).fill("P10");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button",{name:"View Quantitative Entrepreneurial Ecosystems",exact:true}).click();
  await expect(page.getByRole("dialog")).toContainText("LLM");
  await page.getByRole("button",{name:"Assign",exact:true}).click();
  await page.getByLabel("Lab member").selectOption("harsimran");
  await page.getByLabel("Responsibility",{exact:true}).fill("Admin acceptance review");
  await page.getByRole("button",{name:"Save responsibility"}).click();
  await expect(page.getByRole("dialog",{name:"Assign a responsibility",exact:true})).toHaveCount(0);
  await expect(page.getByRole("dialog",{name:"P10 · Project details",exact:true})).toContainText("Admin acceptance review");
  await page.getByRole("button",{name:"Edit",exact:true}).click();
  await page.getByLabel("Next milestone").fill("Review the pilot dataset");
  await page.getByRole("button",{name:"Save project"}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button",{name:"Projects 15",exact:true}).click();
  await page.getByRole("textbox",{name:"Search projects"}).fill("P10");
  await expect(page.locator("tbody")).toContainText("Review the pilot dataset");
  await page.getByRole("textbox",{name:"Search projects"}).fill("");
  await page.getByLabel("Filter by person").selectOption("lin");
  await expect(page.locator("tbody tr")).toHaveCount(2);
});

test("a member submits and reloads a report while unauthorized mutations are refused",async({page})=>{
  await page.goto("/");await page.getByRole("button",{name:"Member view",exact:true}).click();
  await expect(page.getByRole("button",{name:"My projects 1",exact:true})).toBeVisible();
  const workspace=await page.request.get("/api/workspace");const data=await workspace.json();
  expect(data.identity.personId).toBe("hars");expect(data.projects.map((p:{id:string})=>p.id)).toEqual(["P10"]);
  expect(data.updates.every((u:{personId:string})=>u.personId==="hars")).toBeTruthy();
  await page.getByRole("button",{name:"Share progress",exact:true}).click();
  await expect(page.getByText("Last time, you planned to…")).toBeVisible();
  await page.getByLabel("What actually moved forward?").fill("Browser test: completed the pilot comparison.");
  await page.getByRole("radio",{name:"Blocked",exact:true}).check();
  await page.getByLabel("Anything blocking you, or help you need?").fill("Browser test: please review the output.");
  await page.getByLabel("What’s next?").fill("Expand the evaluation set.");
  await page.getByRole("button",{name:"Submit update",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("Update saved");
  await page.getByRole("button",{name:"Updates",exact:true}).click();
  await expect(page.getByText("Browser test: completed the pilot comparison.", {exact:true})).toBeVisible();
  await page.reload();await page.getByRole("button",{name:"Updates",exact:true}).click();
  await expect(page.getByText("Browser test: completed the pilot comparison.", {exact:true})).toBeVisible();
  const headers={Origin:"http://localhost:3100"};
  const forbidden=await page.request.patch("/api/projects",{headers,data:data.projects[0]});expect(forbidden.status()).toBe(403);
  const wrongAssignment=await page.request.post("/api/updates",{headers,data:{assignmentId:"A001",progress:"Spoofed",blockers:"",nextPlan:"",status:"On track"}});expect(wrongAssignment.status()).toBe(403);
  const foreign=await page.request.post("/api/updates",{headers:{Origin:"https://evil.example"},data:{}});expect(foreign.status()).toBe(403);
  const fakeAuthor=await page.request.post("/api/updates",{headers,data:{assignmentId:"A016",personId:"fanny",progress:"Spoofed",status:"On track"}});expect(fakeAuthor.status()).toBe(400);
});

test("admin can connect a member's Google email",async({page})=>{
  await page.goto("/");await page.getByRole("button",{name:"People",exact:true}).click();
  await page.getByRole("button",{name:"Edit Lin",exact:true}).click();
  await page.getByLabel("Google account email").fill("lin-test@example.com");
  await page.getByRole("button",{name:"Save member"}).click();
  await expect(page.getByRole("link",{name:"lin-test@example.com"})).toBeVisible();
  const duplicate=await page.request.patch("/api/people",{headers:{Origin:"http://localhost:3100"},data:{id:"jin",name:"Jin",email:"lin-test@example.com",affiliation:""}});expect(duplicate.status()).toBe(409);
});

test("mobile navigation and reporting fit the screen",async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto("/");
  await page.getByRole("button",{name:"Member view",exact:true}).click();
  await page.getByRole("button",{name:"Open navigation"}).click();
  await page.getByRole("button",{name:"My projects 1",exact:true}).click();
  await page.getByRole("button",{name:"View Quantitative Entrepreneurial Ecosystems",exact:true}).click();
  await expect(page.getByRole("dialog")).toBeVisible();await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button",{name:"Share progress",exact:true}).click();
  const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,window:window.innerWidth}));expect(width.scroll).toBeLessThanOrEqual(width.window);
});

test("production ignores demo mode and denies unauthenticated access",async({request})=>{
  const html=await request.get("http://localhost:3101/");expect(await html.text()).toContain("Google setup is still needed");
  const demo=await request.post("http://localhost:3101/api/demo",{headers:{Origin:"http://localhost:3101"},form:{view:"admin"}});expect(demo.status()).toBe(404);
  const workspace=await request.get("http://localhost:3101/api/workspace");expect(workspace.status()).toBe(401);
  const update=await request.post("http://localhost:3101/api/updates",{headers:{Origin:"http://localhost:3101"},data:{assignmentId:"A016",progress:"Unauthorized",status:"On track"}});expect(update.status()).toBe(401);
});
