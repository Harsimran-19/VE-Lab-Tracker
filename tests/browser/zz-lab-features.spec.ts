import { test, expect } from "@playwright/test";
const origin = "http://localhost:3100";

test("a member proposes a project and attribute, the manager approves, and the member reports hours, meetings, files and data versions", async ({ page, browser }) => {
  test.setTimeout(300000);
  const context = await browser.newContext();
  const member = await context.newPage();
  await member.goto("/");
  await member.request.post("/api/demo", { form: { view: "new" }, headers: { Origin: origin } });
  expect((await member.request.post("/api/onboarding", { data: { name: "Grant writer", projectIds: [] }, headers: { Origin: origin } })).ok()).toBeTruthy();

  // Member: propose a Fund Sourcing project.
  await member.goto("/projects");
  await member.getByRole("button", { name: "Propose a project", exact: true }).click();
  let dialog = member.getByRole("dialog");
  await dialog.getByLabel("Project name", { exact: true }).fill("NSF grant search");
  await dialog.getByLabel("Goal", { exact: true }).fill("Find and apply for a grant");
  await dialog.getByLabel("Project type", { exact: true }).selectOption("Fund Sourcing");
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(member.getByRole("status")).toContainText("sent to the lab manager for approval");
  await member.getByRole("button", { name: /Awaiting approval/ }).click();
  await member.getByRole("link", { name: "NSF grant search", exact: true }).first().click();
  await expect(member.getByRole("region", { name: "Project approval" })).toContainText("Waiting for the lab manager’s approval");
  await expect(member.getByRole("button", { name: "Write weekly update", exact: true })).toHaveCount(0);

  // Member: propose an attribute.
  await member.getByRole("button", { name: "Propose an attribute", exact: true }).click();
  dialog = member.getByRole("dialog");
  await expect(dialog.getByLabel("Attribute", { exact: true })).toHaveValue("Funding source");
  await dialog.getByLabel("Value", { exact: true }).fill("NSF CAREER");
  await dialog.getByRole("button", { name: "Send for approval", exact: true }).click();
  const attributes = member.getByRole("region", { name: "Project attributes" });
  await expect(attributes).toContainText("NSF CAREER");
  await expect(attributes).toContainText("Awaiting approval");
  const projectUrl = member.url();

  // Manager: sees the queue on Home and approves both.
  await page.goto("/");
  const queue = page.getByRole("region", { name: "Waiting for your approval" });
  await expect(queue).toContainText("NSF grant search");
  await expect(queue).toContainText("New attribute: Funding source = NSF CAREER");
  await page.goto(projectUrl);
  await page.getByRole("region", { name: "Project approval" }).getByRole("button", { name: "Approve", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Approve project", exact: true }).click();
  await expect(page.getByRole("region", { name: "Project approval" })).toHaveCount(0);
  await page.getByRole("region", { name: "Project attributes" }).getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByRole("region", { name: "Project attributes" })).not.toContainText("Awaiting approval");

  // Member: weekly update with hours, meetings and a reference file.
  await member.reload();
  await member.getByRole("button", { name: "Write weekly update", exact: true }).click();
  dialog = member.getByRole("dialog");
  await dialog.getByLabel("What did you accomplish?", { exact: true }).fill("Shortlisted three calls");
  await dialog.getByLabel("What will you do next?", { exact: true }).fill("Draft the aims page");
  await dialog.getByLabel("Hours on this project this week", { exact: true }).fill("7.5");
  await dialog.getByLabel("Meeting with the PI", { exact: true }).selectOption("held");
  await dialog.getByLabel("Date of meeting with the PI", { exact: true }).fill("2026-10-14");
  await dialog.getByLabel("Meeting with external collaborators", { exact: true }).selectOption("scheduled");
  await dialog.getByLabel("Collaborators met", { exact: true }).fill("Partner university");
  await dialog.getByRole("button", { name: "Add reference file", exact: true }).click();
  await dialog.getByLabel("Reference file 1 name", { exact: true }).fill("Call shortlist");
  await dialog.getByLabel("Reference file 1 URL", { exact: true }).fill("https://drive.google.com/file/d/shortlist");
  await dialog.getByRole("button", { name: "Submit update", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await member.getByRole("tab", { name: "Updates" }).click();
  const panel = member.getByRole("tabpanel");
  await expect(panel.getByRole("region", { name: "Weekly hours" })).toContainText("7.5 h");
  await expect(panel).toContainText("Met");
  await expect(panel).toContainText("Partner university");
  await expect(panel.getByRole("link", { name: "Call shortlist" })).toHaveAttribute("href", "https://drive.google.com/file/d/shortlist");

  // Member: two data versions.
  await member.getByRole("tab", { name: "Data & outputs" }).click();
  await member.getByRole("button", { name: "Add dataset", exact: true }).click();
  dialog = member.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("Funding calls");
  await dialog.getByLabel("Link to this version", { exact: true }).fill("https://drive.google.com/calls-v1");
  await dialog.getByLabel("What changed?", { exact: true }).fill("First list");
  await dialog.getByRole("button", { name: "Save version", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await member.getByRole("button", { name: "Add new version", exact: true }).click();
  dialog = member.getByRole("dialog");
  await dialog.getByLabel("Link to this version", { exact: true }).fill("https://drive.google.com/calls-v2");
  await dialog.getByLabel("What changed?", { exact: true }).fill("Added deadlines");
  await dialog.getByRole("button", { name: "Save version", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const data = member.getByRole("region", { name: "Data" });
  await expect(data).toContainText("Funding calls v2");
  await data.getByText("Version history (2)").click();
  await expect(data).toContainText("First list");

  // Member: profile appears in the team directory search.
  await member.goto("/account");
  await member.getByLabel("Research interests", { exact: true }).fill("science funding, grant writing");
  await member.getByLabel("Skills", { exact: true }).fill("Budgets");
  await member.getByRole("button", { name: "Save account", exact: true }).click();
  await expect(member.getByRole("status")).toContainText("Account saved");
  await page.goto("/team");
  await page.getByLabel("Search people", { exact: true }).fill("grant writing");
  await expect(page.getByRole("table")).toContainText("Grant writer");
  await page.getByRole("link", { name: "View Grant writer", exact: true }).click();
  await expect(page.getByRole("main")).toContainText("Budgets");
  await expect(page.getByRole("main")).toContainText("7.5 h this week");
  await context.close();
});
