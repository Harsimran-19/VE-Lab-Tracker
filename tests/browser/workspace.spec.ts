import { test, expect, type Page } from "@playwright/test";

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", (error) => list.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
async function sample(page: Page, view: "admin" | "member" | "new") {
  await page.goto("/");
  const response = await page.request.post("/api/demo", {
    form: { view },
    headers: { Origin: "http://localhost:3100" },
  });
  expect(response.ok()).toBe(true);
  await page.goto("/");
}
async function jsonWrite(
  page: Page,
  path: string,
  data: unknown,
  method = "POST",
) {
  return page.request.fetch(path, {
    method,
    data,
    headers: {
      Origin: "http://localhost:3100",
      "Content-Type": "application/json",
    },
  });
}

test("dashboard summarizes the lab while projects and people have separate pages", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await sample(page, "admin");
  await expect(
    page.getByRole("heading", { name: "Lab dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Needs attention" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Weekly reporting" }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.locator(".research-card")).toHaveCount(0);
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
  await page
    .getByRole("button", { name: "Invite the lab", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Invite link copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "http://localhost:3100",
  );
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Projects", exact: true })
    .click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.locator(".research-card")).toHaveCount(15);
  await page.screenshot({ path: "test-results/projects.png", fullPage: true });
  await page.getByRole("textbox", { name: "Search projects" }).fill("LLM");
  await expect(page.locator(".research-card").first()).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search projects" })
    .fill("impossible-project-search");
  await expect(
    page.getByRole("heading", { name: "No matching projects" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "People", exact: true })
    .click();
  await expect(page).toHaveURL(/\/people$/);
  await expect(page.locator(".person-card")).toHaveCount(11);
  await expect(page.locator(".research-card")).toHaveCount(0);
});

test("member reports progress in a project; authorship, previous plans and retries are preserved", async ({
  page,
}) => {
  await sample(page, "member");
  await expect(
    page.getByRole("heading", { name: "My dashboard", exact: true }),
  ).toBeVisible();
  await page.goto("/projects/P10");
  await page
    .getByRole("button", { name: "Weekly update", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Weekly update" });
  await expect(
    dialog.getByRole("combobox", { name: "Project", exact: true }),
  ).toHaveValue("P10");
  await expect(dialog.getByText("Previously, you planned to…")).toBeVisible();
  await dialog
    .getByLabel("Progress made")
    .fill("Browser test: completed pilot model comparison.");
  await dialog.getByRole("radio", { name: "Blocked", exact: true }).check();
  await dialog
    .getByLabel(/Blockers or help needed/)
    .fill("Browser test: need source documents.");
  await dialog
    .getByLabel(/Next week’s plan/)
    .fill("Browser test: validate results next week.");
  await dialog.getByRole("button", { name: "Publish update" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page
      .locator(".update-card")
      .filter({ hasText: "Browser test: completed pilot model comparison." }),
  ).toContainText("Hars");
  const store = await (await page.request.get("/api/workspace")).json();
  const saved = store.updates.find(
    (u: { progress: string }) =>
      u.progress === "Browser test: completed pilot model comparison.",
  );
  expect(saved.personId).toBe("hars");
  expect(
    store.assignments.find((a: { id: string }) => a.id === "A016").status,
  ).toBe("Blocked");
  const retry = await jsonWrite(page, "/api/entries", {
    entryId: saved.id,
    projectId: "P10",
    progress: "Attempt to change saved content",
    status: "Done",
  });
  expect(retry.status()).toBe(200);
  const after = await (await page.request.get("/api/workspace")).json();
  expect(
    after.updates.filter((u: { id: string }) => u.id === saved.id),
  ).toHaveLength(1);
  expect(
    after.updates.find((u: { id: string }) => u.id === saved.id).progress,
  ).toBe(saved.progress);
  expect(
    after.assignments.find((a: { id: string }) => a.id === "A016").status,
  ).toBe("Blocked");
});

test("new Google-style member joins a project without admin setup and sees team progress", async ({
  page,
}) => {
  await sample(page, "new");
  await expect(
    page.getByRole("heading", { name: "Your account is ready." }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Explore projects", exact: true })
    .click();
  await expect(page.locator(".research-card")).toHaveCount(15);
  await expect(
    page.getByRole("button", { name: "Create project" }),
  ).toHaveCount(0);
  await page.goto("/projects/P04");
  await expect(
    page.locator(".update-card").filter({ hasText: "Sample: finished coding" }),
  ).toContainText("Lin");
  await page.getByRole("button", { name: "Join project", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Weekly update", exact: true }),
  ).toBeVisible();
  const before = await (await page.request.get("/api/workspace")).json();
  const repeat = await jsonWrite(page, "/api/join", { projectId: "P04" });
  expect(repeat.status()).toBe(200);
  const joined = await (await page.request.get("/api/workspace")).json();
  expect(
    joined.assignments.filter(
      (a: { personId: string; projectId: string }) =>
        a.personId === joined.identity.personId && a.projectId === "P04",
    ),
  ).toHaveLength(1);
  expect(joined.assignments.length).toBe(before.assignments.length);
  await page
    .getByRole("button", { name: "Weekly update", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Progress made")
    .fill("New member: reviewed shared field notes.");
  await dialog.getByRole("button", { name: "Publish update" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".update-card")).toHaveCount(2);
  const after = await (await page.request.get("/api/workspace")).json();
  expect(
    after.updates.find(
      (u: { progress: string }) =>
        u.progress === "New member: reviewed shared field notes.",
    ).personId,
  ).toBe(joined.identity.personId);
});

test("profiles support expertise discovery and members cannot change identities or roles", async ({
  page,
}) => {
  await sample(page, "new");
  await page
    .getByRole("link", { name: "Add your expertise to your profile" })
    .click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.getByLabel("Name", { exact: true }).fill("Expertise test member");
  await page.getByLabel("Position", { exact: true }).selectOption("PhD");
  await page
    .getByLabel("Expertise", { exact: true })
    .fill("Causal inference, Network analysis");
  await page
    .getByLabel("Research interests", { exact: true })
    .fill("Collaboration on entrepreneurial ecosystems.");
  await page
    .getByRole("checkbox", { name: "Send me deadline reminders" })
    .uncheck();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toContainText("Profile saved");
  const profile = await (await page.request.get("/api/workspace")).json();
  expect(
    profile.profiles.find(
      (p: { id: string }) => p.id === profile.identity.personId,
    ).reminders,
  ).toBe("false");
  const forged = await jsonWrite(
    page,
    "/api/profile",
    {
      name: "Forged",
      affiliation: "",
      position: "PhD",
      expertise: "",
      bio: "",
      reminders: true,
      id: "harsimran",
      role: "admin",
    },
    "PATCH",
  );
  expect(forged.status()).toBe(400);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "People", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search people and expertise" })
    .fill("Causal inference");
  await expect(page.locator(".person-card")).toHaveCount(1);
  await expect(page.locator(".person-card")).toContainText(
    "Expertise test member",
  );
  await page.getByRole("button", { name: "View profile", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Collaboration on entrepreneurial ecosystems.",
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.reload();
  await expect(
    page.locator(".person-card").filter({ hasText: "Expertise test member" }),
  ).toContainText("Causal inference");
});

test("shared reading does not allow editing another person's progress or administrator data", async ({
  page,
}) => {
  await sample(page, "member");
  await page.goto("/projects/P04");
  await expect(
    page.getByText("Sample: finished coding the next batch of field notes."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Manage project" }),
  ).toHaveCount(0);
  expect(
    (
      await jsonWrite(page, "/api/updates", {
        assignmentId: "A004",
        progress: "Forged",
        status: "Done",
      })
    ).status(),
  ).toBe(403);
  expect((await jsonWrite(page, "/api/projects", {}, "PATCH")).status()).toBe(
    403,
  );
  expect((await jsonWrite(page, "/api/projects", {})).status()).toBe(403);
  expect((await jsonWrite(page, "/api/people", {}, "PATCH")).status()).toBe(
    403,
  );
  expect((await jsonWrite(page, "/api/assignments", {})).status()).toBe(403);
  expect(
    (
      await jsonWrite(page, "/api/entries", {
        entryId: "e2e4e444-0011-4444-8111-002244668899",
        newProjectName: "Unauthorized project",
        progress: "Forged",
        status: "On track",
      })
    ).status(),
  ).toBe(403);
  expect(
    (await page.request.get("/api/member-preview?personId=hars")).status(),
  ).toBe(403);
});

test("admin creates projects and manages phases, milestones and responsibility deadlines", async ({
  page,
}) => {
  await sample(page, "admin");
  await page.goto("/projects");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  let dialog = page.getByRole("dialog", { name: "Create project" });
  await dialog
    .getByLabel("Project name", { exact: true })
    .fill("Browser collaboration project");
  await dialog
    .getByLabel("Full research title")
    .fill("Understand collaboration patterns in the remote lab.");
  await dialog.getByLabel("Research stage").selectOption("Data collection");
  await dialog.getByLabel("Next milestone").fill("Run the pilot study");
  await dialog.getByLabel("Milestone due date").fill("2026-10-08");
  await dialog.getByRole("button", { name: "Save project" }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .locator(".research-card")
    .filter({ hasText: "Browser collaboration project" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Browser collaboration project",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Research phase: Data collection"),
  ).toBeVisible();
  await expect(page.locator(".milestone-strip")).toContainText(
    "Run the pilot study",
  );
  await page.getByRole("button", { name: "Manage project" }).click();
  dialog = page.getByRole("dialog", { name: "Manage project" });
  await dialog.getByLabel("Research stage").selectOption("Data analysis");
  await dialog.getByRole("button", { name: "Save project" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel("Research phase: Data analysis")).toBeVisible();
  await page.getByRole("tab", { name: "Team & responsibilities" }).click();
  await page.getByRole("button", { name: "Assign", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Lab member").selectOption("hars");
  await dialog
    .getByLabel("Responsibility", { exact: true })
    .fill("Interview coding");
  await dialog.getByLabel("Due date", { exact: true }).fill("2026-10-09");
  await dialog.getByRole("button", { name: "Save responsibility" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("tabpanel")).toContainText("Interview coding");
  await page.reload();
  await expect(page.getByLabel("Research phase: Data analysis")).toBeVisible();
});

test("production member preview follows navigation and protects the real administrator", async ({
  page,
}) => {
  await sample(page, "admin");
  await page.goto("/people");
  await page.getByRole("link", { name: "Preview Hars", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My dashboard", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Member preview")).toContainText("Hars");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Projects", exact: true })
    .click();
  await expect(page).toHaveURL(/preview=hars/);
  await expect(
    page.getByRole("button", { name: "Create project" }),
  ).toHaveCount(0);
  await page.goto("/projects/P10?preview=hars");
  await page
    .getByRole("button", { name: "Weekly update", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saving disabled in preview" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  expect(
    (await (await page.request.get("/api/workspace")).json()).identity.role,
  ).toBe("admin");
  await page.getByRole("link", { name: "Return to admin" }).click();
  await page
    .getByRole("button", { name: "Edit account for Harsimran", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Google account email"),
  ).toBeDisabled();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("combobox", { name: "Role", exact: true }),
  ).toBeDisabled();
});

test("mobile navigation, project workspace and weekly form remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await sample(page, "member");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Projects", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/projects/P10");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Weekly update", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Progress made").fill("Mobile report test");
  await dialog.getByRole("button", { name: "Publish update" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Mobile report test", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-project.png",
    fullPage: true,
  });
});

test("production rejects demo authentication, anonymous reads and writes, and unauthorized cron", async ({
  page,
}) => {
  const origin = "http://localhost:3101";
  await page.goto(origin);
  await expect(page.getByText("Google setup is still needed")).toBeVisible();
  for (const view of ["admin", "member", "new", "person:harsimran"])
    expect(
      (
        await page.request.post(`${origin}/api/demo`, { form: { view } })
      ).status(),
    ).toBe(404);
  expect((await page.request.get(`${origin}/api/workspace`)).status()).toBe(
    401,
  );
  for (const path of ["entries", "join", "projects"])
    expect(
      (
        await page.request.post(`${origin}/api/${path}`, {
          data: {},
          headers: { Origin: origin },
        })
      ).status(),
    ).toBe(401);
  expect(
    (
      await page.request.patch(`${origin}/api/profile`, {
        data: {},
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(401);
  // No configured cron secret: fail closed, without attempting email or Sheets.
  expect(
    (await page.request.get(`${origin}/api/cron/reminders`)).status(),
  ).toBe(503);
});

test("project deep links support browser history and missing projects show a helpful page", async ({
  page,
}) => {
  await sample(page, "member");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Projects", exact: true })
    .click();
  await page.locator(".research-card").filter({ hasText: "P10" }).click();
  await expect(page).toHaveURL(/\/projects\/P10$/);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  await page.goto("/projects/does-not-exist");
  await expect(
    page.getByRole("heading", { name: "Project not found." }),
  ).toBeVisible();
});
