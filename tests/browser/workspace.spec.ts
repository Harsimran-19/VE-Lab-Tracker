import { test, expect, type Page } from "@playwright/test";
const failures = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const messages: string[] = [];
  failures.set(page, messages);
  page.on("pageerror", (e) => messages.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(failures.get(page)).toEqual([]);
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
async function write(page: Page, path: string, data: unknown, method = "POST") {
  return page.request.fetch(path, {
    method,
    data,
    headers: {
      Origin: "http://localhost:3100",
      "Content-Type": "application/json",
    },
  });
}
async function store(page: Page) {
  return (await page.request.get("/api/workspace")).json();
}
async function onboard(page: Page, name: string, project?: string) {
  await page.getByLabel("Your name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  if (project)
    await page
      .getByRole("checkbox", { name: `Join ${project}`, exact: true })
      .check();
  await page
    .getByRole("button", {
      name: project ? "Open my work" : "Choose projects later",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "My work", exact: true }),
  ).toBeVisible();
}

test.describe.configure({ mode: "serial" });
let pilotId = "";
test("manager starts with an empty lab and creates a project using only name and goal", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await sample(page, "admin");
  await expect(
    page.getByRole("heading", { name: "Start with your first project" }),
  ).toBeVisible();
  const initial = await store(page);
  expect(initial.projects).toHaveLength(0);
  expect(initial.memberships).toHaveLength(0);
  expect(initial.updates).toHaveLength(0);
  expect(initial.people).toHaveLength(1);
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Create project" });
  await expect(dialog.getByRole("textbox")).toHaveCount(2);
  await expect(dialog.getByRole("combobox")).toHaveCount(0);
  await dialog
    .getByLabel("Project name", { exact: true })
    .fill("Interview pilot");
  await dialog
    .getByLabel("Goal", { exact: true })
    .fill("Understand how founders collaborate.");
  await dialog
    .getByRole("button", { name: "Save project", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("table")).toContainText("Interview pilot");
  const after = await store(page);
  expect(after.projects).toHaveLength(1);
  expect(after.projects[0].phase).toBe("Idea");
  pilotId = after.projects[0].id;
  await page
    .getByRole("button", { name: "Share website", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Website link copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "http://localhost:3100",
  );
  await page.screenshot({
    path: "test-results/manager-overview.png",
    fullPage: true,
  });
});

test("member confirms only their name, joins a project and edits one weekly report", async ({
  page,
}) => {
  await sample(page, "member");
  await expect(
    page.getByRole("heading", { name: "What should we call you?" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(1);
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page.getByLabel("Your name", { exact: true }).fill("   ");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Enter your name." }),
  ).toHaveText("Enter your name.");
  await expect(
    page.getByRole("heading", { name: "What should we call you?" }),
  ).toBeVisible();
  await onboard(page, "Alex Chen", "Interview pilot");
  await page
    .getByRole("button", {
      name: "Write update for Interview pilot",
      exact: true,
    })
    .click();
  let dialog = page.getByRole("dialog", { name: "Write weekly update" });
  await expect(dialog.getByRole("combobox")).toHaveCount(0);
  await expect(dialog.getByRole("radio")).toHaveCount(0);
  await expect(dialog.getByRole("textbox")).toHaveCount(2);
  await expect(
    dialog.getByLabel("What is blocking you?", { exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByLabel("What did you accomplish?", { exact: true })
    .fill("Finished the first interviews.");
  await dialog
    .getByLabel("What will you do next?", { exact: true })
    .fill("Code the interview notes.");
  await dialog
    .getByRole("checkbox", { name: "I need help", exact: true })
    .check();
  await expect(dialog.getByRole("textbox")).toHaveCount(3);
  await dialog
    .getByLabel("What is blocking you?", { exact: true })
    .fill("Need the recording folder.");
  await dialog
    .getByRole("button", { name: "Submit update", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Weekly update saved");
  const before = await store(page);
  expect(before.updates).toHaveLength(1);
  expect(before.updates[0].personId).toBe(before.identity.personId);
  await page
    .getByRole("button", {
      name: "Edit update for Interview pilot",
      exact: true,
    })
    .click();
  dialog = page.getByRole("dialog", { name: "Edit this week’s update" });
  await expect(
    dialog.getByLabel("What did you accomplish?", { exact: true }),
  ).toHaveValue("Finished the first interviews.");
  await dialog
    .getByLabel("What did you accomplish?", { exact: true })
    .fill("Finished interviews and received the recordings.");
  await dialog
    .getByRole("checkbox", { name: "I need help", exact: true })
    .uncheck();
  await expect(
    dialog.getByLabel("What is blocking you?", { exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const after = await store(page);
  expect(after.updates).toHaveLength(1);
  expect(after.updates[0].id).toBe(before.updates[0].id);
  expect(after.updates[0].createdAt).toBe(before.updates[0].createdAt);
  expect(after.updates[0].blockers).toBe("");
  expect(after.updates[0].needsHelp).toBe("false");
  await page.screenshot({ path: "test-results/my-work.png", fullPage: true });
});

test("members read team progress and self-join but cannot change manager data or another identity", async ({
  page,
}) => {
  await sample(page, "new");
  await onboard(page, "Jamie Rao");
  const memberCookies = await page.context().cookies();
  const newMember = (await store(page)).identity.personId;
  // Signing up is enough to appear in Team: no project membership is required.
  await sample(page, "admin");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Team", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Team", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".team-card")).toHaveCount(3);
  const unjoined = page.locator(".team-card").filter({ hasText: "Jamie Rao" });
  await expect(unjoined).toContainText("No projects joined");
  await unjoined.click();
  await expect(
    page.getByRole("heading", { name: "Jamie Rao", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No projects joined", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Edit my account", exact: true }),
  ).toHaveCount(0);
  await page.context().addCookies(memberCookies);
  await page.goto(`/team/${newMember}`);
  await expect(
    page.getByRole("link", { name: "Edit my account", exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await page
    .getByRole("link", { name: "Choose a project", exact: true })
    .click();
  await page
    .locator(".research-card")
    .filter({ hasText: "Interview pilot" })
    .click();
  await expect(
    page.getByText("Finished interviews and received the recordings.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Manage project", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Join project", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Write weekly update", exact: true }),
  ).toBeVisible();
  const before = await store(page);
  expect((await write(page, "/api/join", { projectId: pilotId })).ok()).toBe(
    true,
  );
  expect((await store(page)).memberships.length).toBe(
    before.memberships.length,
  );
  await page
    .getByRole("button", { name: "Write weekly update", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("What did you accomplish?", { exact: true })
    .fill("Reviewed the sampling plan.");
  await dialog
    .getByLabel("What will you do next?", { exact: true })
    .fill("Recruit more participants.");
  await dialog
    .getByRole("checkbox", { name: "I need help", exact: true })
    .check();
  await dialog
    .getByLabel("What is blocking you?", { exact: true })
    .fill("Need approval for recruitment.");
  await dialog
    .getByRole("button", { name: "Submit update", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".update-card")).toHaveCount(2);
  expect((await write(page, "/api/projects", {}, "PATCH")).status()).toBe(403);
  expect((await write(page, "/api/projects", {})).status()).toBe(403);
  expect((await write(page, "/api/settings", {}, "PATCH")).status()).toBe(403);
  expect((await write(page, "/api/email-test", {})).status()).toBe(403);
  expect(
    (
      await write(
        page,
        "/api/profile",
        { name: "Forged", reminders: true, id: "manager", role: "admin" },
        "PATCH",
      )
    ).status(),
  ).toBe(400);
  expect(
    (
      await write(page, "/api/entries", {
        projectId: pilotId,
        weekStart: before.weekStart,
        progress: "Forged",
        nextPlan: "Next",
        needsHelp: false,
        blockers: "",
        personId: "manager",
      })
    ).status(),
  ).toBe(400);
});

test("Team lets both roles open current member details and projects on desktop and mobile", async ({
  page,
}) => {
  await sample(page, "admin");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Team", exact: true })
    .click();
  await expect(page.locator(".team-card")).toHaveCount(3);
  await page.screenshot({
    path: "test-results/team-directory.png",
    fullPage: true,
  });
  await page.locator(".team-card").filter({ hasText: "Alex Chen" }).click();
  await expect(
    page.getByRole("heading", { name: "Alex Chen", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "member@demo.invalid", exact: true }),
  ).toHaveAttribute("href", "mailto:member@demo.invalid");
  await expect(
    page.getByRole("link", { name: "Edit my account", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".research-card")
    .filter({ hasText: "Interview pilot" })
    .click();
  await page
    .locator(".project-members")
    .getByRole("link", { name: "Jamie Rao", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Jamie Rao", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".research-card")).toContainText("Interview pilot");
  await page.screenshot({
    path: "test-results/member-details.png",
    fullPage: true,
  });
  // Next.js can stream a not-found page with HTTP 200; verify its actual UI.
  await page.goto("/team/does-not-exist");
  await expect(
    page.getByRole("heading", { name: "Member not found.", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".member-contact")).toHaveCount(0);
  await page.getByRole("link", { name: "Back to Team", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Team", exact: true }),
  ).toBeVisible();
  await page.goto("/people");
  await expect(page).toHaveURL(/\/team$/);
  await sample(page, "member");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Team", exact: true })
    .click();
  await expect(page.locator(".team-card")).toHaveCount(3);
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Team", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-team.png",
    fullPage: true,
  });
  await page.locator(".team-card").filter({ hasText: "Jamie Rao" }).click();
  await expect(
    page.getByRole("heading", { name: "Jamie Rao", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-member-details.png",
    fullPage: true,
  });
  await page.locator(".research-card").click();
  await expect(
    page.getByText("Reviewed the sampling plan.", { exact: true }),
  ).toBeVisible();
});

test("manager reviews real members, sets only phase and milestone, and completion stops reporting", async ({
  page,
}) => {
  await sample(page, "admin");
  await expect(page.getByRole("table")).toContainText("2/2 shared");
  await expect(
    page.getByRole("heading", { name: "Requests for help" }),
  ).toBeVisible();
  await expect(page.locator(".attention-row")).toContainText("Jamie Rao");
  await page
    .getByRole("table")
    .getByRole("link", { name: "Interview pilot", exact: true })
    .click();
  await expect(page.locator(".project-members")).toContainText("Alex Chen");
  await expect(page.locator(".project-members")).toContainText("Jamie Rao");
  await page.getByRole("button", { name: "Change phase", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Change research phase" });
  await expect(dialog.getByRole("combobox")).toHaveCount(1);
  await dialog.getByLabel("Current phase").selectOption("Data collection");
  await dialog
    .getByRole("button", { name: "Save project", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".phase-summary")).toContainText("Data collection");
  await page
    .getByRole("button", { name: "Set milestone", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Set next milestone" });
  await expect(dialog.locator("input")).toHaveCount(2);
  await dialog
    .getByLabel("Milestone", { exact: true })
    .fill("Finish pilot interviews");
  const s = await store(page);
  const date = new Date(`${s.today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  await dialog
    .getByLabel("Due date", { exact: true })
    .fill(date.toISOString().slice(0, 10));
  await dialog
    .getByRole("button", { name: "Save project", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".milestone-strip")).toContainText(
    "Finish pilot interviews",
  );
  await page.screenshot({
    path: "test-results/project-workspace.png",
    fullPage: true,
  });
  await page.getByText("Manage project", { exact: true }).click();
  await page
    .getByRole("button", { name: "Complete project", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Complete project" });
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Complete project", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Completed project", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Write weekly update", exact: true }),
  ).toHaveCount(0);
  await sample(page, "member");
  await expect(
    page.getByRole("heading", { name: "Your projects are complete" }),
  ).toBeVisible();
  const me = await store(page);
  expect(
    (
      await write(page, "/api/entries", {
        projectId: pilotId,
        weekStart: me.weekStart,
        progress: "Late",
        nextPlan: "Next",
        needsHelp: false,
        blockers: "",
      })
    ).status(),
  ).toBe(409);
  expect(
    (await write(page, "/api/join", { projectId: pilotId })).status(),
  ).toBe(409);
  await page.goto(`/projects/${pilotId}`);
  await expect(page.locator(".update-card")).toHaveCount(2);
});

test("account keeps optional research details collapsed; manager sets the schedule and previews email", async ({
  page,
}) => {
  await sample(page, "admin");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Account & settings", exact: true })
    .click();
  await expect(
    page.locator(".profile-form").first().getByRole("textbox"),
  ).toHaveCount(1);
  await page.getByLabel("Reporting day", { exact: true }).selectOption("5");
  await page.getByLabel("Reporting time", { exact: true }).fill("18:00");
  await page
    .getByLabel("Lab timezone", { exact: true })
    .selectOption("Asia/Hong_Kong");
  await page
    .getByRole("button", { name: "Save schedule", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Reporting schedule saved",
  );
  await page.reload();
  expect((await store(page)).settings.timezone).toBe("Asia/Hong_Kong");
  expect(
    (
      await write(page, "/api/email-test", { to: "other@example.com" })
    ).status(),
  ).toBe(400);
  await page
    .getByRole("button", { name: "Preview test email", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("No email was sent");
  await sample(page, "member");
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Weekly reporting schedule" }),
  ).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "Email me relevant reminders", exact: true })
    .uncheck();
  await page.getByRole("button", { name: "Save account", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Account saved");
  const member = await store(page);
  expect(
    member.people.find((p: { id: string }) => p.id === member.identity.personId)
      .reminders,
  ).toBe("false");
});

test("mobile welcome, project help and weekly form are usable without redundant inputs", async ({
  page,
}) => {
  await sample(page, "admin");
  const id = "22222222-2222-4222-8222-222222222222";
  expect(
    (
      await write(page, "/api/projects", {
        id,
        name: "Mobile study",
        goal: "Validate the mobile reporting journey.",
      })
    ).ok(),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await sample(page, "new");
  await onboard(page, "Mobile member", "Mobile study");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto(`/projects/${id}`);
  const help = page.getByRole("button", { name: "Help: Research phase" });
  await help.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("note")).toContainText("whole research project");
  const bounds = await page.getByRole("note").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  await expect(help).toHaveAttribute("aria-expanded", "false");
  await page
    .getByRole("button", { name: "Write weekly update", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("textbox")).toHaveCount(2);
  await dialog
    .getByLabel("What did you accomplish?", { exact: true })
    .fill("Verified the mobile flow.");
  await dialog
    .getByLabel("What will you do next?", { exact: true })
    .fill("Review results with the manager.");
  await page.screenshot({
    path: "test-results/mobile-report-form.png",
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "Submit update", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Verified the mobile flow.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-project.png",
    fullPage: true,
  });
});

test("removed legacy flows stay unavailable and anonymous production cannot read, write or impersonate", async ({
  page,
}) => {
  const origin = "http://localhost:3101";
  await page.goto(origin);
  await expect(page.getByText("Google setup is still needed")).toBeVisible();
  for (const path of ["/team", "/team/private-member"]) {
    await page.goto(`${origin}${path}`);
    await expect(page.getByText("Google setup is still needed")).toBeVisible();
    await expect(page.locator(".team-card, .member-contact")).toHaveCount(0);
    await expect(page.getByRole("navigation")).toHaveCount(0);
  }
  expect(
    (
      await page.request.post(`${origin}/api/demo`, { form: { view: "admin" } })
    ).status(),
  ).toBe(404);
  expect((await page.request.get(`${origin}/api/workspace`)).status()).toBe(
    401,
  );
  for (const path of [
    "projects",
    "entries",
    "join",
    "onboarding",
    "email-test",
  ])
    expect(
      (
        await page.request.post(`${origin}/api/${path}`, {
          data: {},
          headers: { Origin: origin },
        })
      ).status(),
    ).toBe(401);
  for (const path of ["profile", "settings", "workstreams"])
    expect(
      (
        await page.request.patch(`${origin}/api/${path}`, {
          data: {},
          headers: { Origin: origin },
        })
      ).status(),
    ).toBe(401);
  for (const path of [
    "roster-links",
    "people",
    "assignments",
    "member-preview",
    "setup",
  ])
    expect((await page.request.get(`${origin}/api/${path}`)).status()).toBe(
      404,
    );
  expect(
    (await page.request.get(`${origin}/api/cron/reminders`)).status(),
  ).toBe(503);
});

test("research detail stays optional while owners track responsibilities and share one report", async ({
  page,
}) => {
  test.setTimeout(120000);
  await sample(page, "admin");
  const projectId = crypto.randomUUID();
  expect(
    (
      await write(page, "/api/projects", {
        id: projectId,
        name: "Research detail pilot",
        goal: "Study how teams learn",
      })
    ).ok(),
  ).toBe(true);
  const managerData = await store(page);
  await page.goto(`/projects/${projectId}`);
  await expect(
    page.getByRole("button", { name: "Progress", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Edit research details" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Project details", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit research details", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Full research title", { exact: true })
    .fill("How Research Teams Learn from Peer Feedback");
  await dialog
    .getByLabel("Project lead", { exact: true })
    .selectOption(managerData.identity.personId);
  await dialog.getByLabel("Priority", { exact: true }).selectOption("Push");
  await dialog
    .getByLabel("Research methods", { exact: true })
    .fill("Mixed methods: interviews and surveys");
  await dialog
    .getByRole("button", { name: "Add a resource link", exact: true })
    .click();
  await dialog.getByLabel("Link name", { exact: true }).fill("Research folder");
  await dialog
    .getByLabel("URL", { exact: true })
    .fill("https://example.com/research");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Research folder" }),
  ).toHaveAttribute("href", "https://example.com/research");
  await page.getByText("Publication", { exact: true }).click();
  await page
    .getByRole("button", { name: "Edit publication plan", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Publication status", { exact: true })
    .selectOption("Under review");
  await dialog
    .getByLabel("Target journal", { exact: true })
    .fill("Research Journal");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.getByText("Collaborators", { exact: true }).click();
  await page
    .getByRole("button", { name: "Add collaborator", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("Taylor Lee");
  await dialog.getByLabel("Role on project", { exact: true }).fill("Co-author");
  await dialog
    .getByLabel("Affiliation", { exact: true })
    .fill("Partner university");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".collaborator-row")).toContainText("Taylor Lee");
  await page.screenshot({
    path: "test-results/research-details.png",
    fullPage: true,
  });
  await sample(page, "member");
  if ((await store(page)).needsOnboarding) await onboard(page, "Alex Chen");
  await page.goto(`/projects/${projectId}`);
  await page.getByRole("button", { name: "Join project", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Write weekly update", exact: true }),
  ).toBeVisible();
  const personId = (await store(page)).identity.personId;
  await sample(page, "admin");
  await page.goto(`/projects/${projectId}`);
  for (const name of ["Literature review", "Data collection"]) {
    await page
      .getByRole("button", { name: "Add responsibility", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Responsibility", { exact: true }).fill(name);
    await dialog.getByLabel("Owner", { exact: true }).selectOption(personId);
    await dialog
      .getByLabel("Status", { exact: true })
      .selectOption("In progress");
    await dialog
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
  }
  await page.screenshot({
    path: "test-results/research-progress.png",
    fullPage: true,
  });
  await sample(page, "member");
  await expect(page.locator(".my-responsibility")).toHaveCount(2);
  await page.goto(`/projects/${projectId}`);
  await page
    .getByLabel("Status for Literature review", { exact: true })
    .selectOption("Blocked");
  await expect(page.getByRole("status")).toContainText(
    "Responsibility updated",
  );
  const memberData = await store(page);
  const stream = memberData.projects.find(
    (p: { id: string }) => p.id === projectId,
  ).workstreams[0];
  expect(
    (
      await write(
        page,
        "/api/workstreams",
        {
          projectId,
          action: "save",
          workstream: {
            ...stream,
            archived: undefined,
            name: "Forged assignment",
          },
        },
        "PATCH",
      )
    ).status(),
  ).toBe(403);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Write weekly update", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("textbox")).toHaveCount(2);
  await dialog
    .getByText("Which responsibilities does this cover?", { exact: false })
    .click();
  await dialog
    .getByRole("checkbox", { name: "Literature review", exact: true })
    .check();
  await dialog
    .getByRole("checkbox", { name: "Data collection", exact: true })
    .check();
  await dialog
    .getByLabel("What did you accomplish?", { exact: true })
    .fill("Reviewed papers and gathered pilot responses.");
  await dialog
    .getByLabel("What will you do next?", { exact: true })
    .fill("Compare the findings.");
  await page.screenshot({
    path: "test-results/mobile-research-report.png",
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "Submit update", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".report-workstreams")).toContainText(
    "Literature review · Data collection",
  );
  await page.reload();
  await expect(page.locator(".project-meta")).toContainText(
    "Last report today",
  );
  await page
    .getByRole("button", { name: "Project details", exact: true })
    .click();
  await expect(
    page.getByText("How Research Teams Learn from Peer Feedback", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit research details", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-research-details.png",
    fullPage: true,
  });
  await page.goto("/account");
  await page.getByText("Research profile", { exact: false }).click();
  await page
    .getByLabel("Academic role", { exact: true })
    .fill("Research assistant");
  await page
    .getByLabel("Affiliation", { exact: true })
    .fill("Venture Engineering Lab");
  await page.getByRole("button", { name: "Save account", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Account saved");
  await page.goto(`/team/${personId}`);
  await expect(page.locator(".member-affiliation")).toContainText(
    "Research assistant · Venture Engineering Lab",
  );
  await sample(page, "admin");
  await page.goto(`/projects/${projectId}`);
  await page
    .getByRole("button", { name: "Edit Literature review", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Archive responsibility", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".responsibility-row")).toHaveCount(1);
  await expect(page.locator(".report-workstreams")).toContainText(
    "Literature review",
  );
  await page.getByText("Manage project", { exact: true }).click();
  await page.getByRole("button", { name: "Put on hold", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Put on hold", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Project on hold", { exact: true }),
  ).toBeVisible();
  await sample(page, "member");
  expect(
    (
      await write(page, "/api/entries", {
        projectId,
        weekStart: (await store(page)).weekStart,
        progress: "Late",
        nextPlan: "Later",
        needsHelp: false,
        blockers: "",
      })
    ).status(),
  ).toBe(409);
});
