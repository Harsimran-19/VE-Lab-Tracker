import "server-only";
import seed from "./seed.json";
import { isDemo } from "./config";
import { appendSheet, initializeSheet, readSheet, replaceSheet } from "./sheets";
import type { Assignment, Person, Project, Store, Update } from "./types";

const globals = globalThis as unknown as { veLabDemo?: Store };
function demoStore(): Store {
  if (!globals.veLabDemo) {
    globals.veLabDemo = structuredClone(seed) as Store;
    const now = Date.now();
    const examples = [
      { personId: "hars", assignmentId: "A016", projectId: "P10", progress: "Sample: evaluated the first LLM extraction prompt against the pilot dataset.", blockers: "Sample: need access to the remaining source documents.", nextPlan: "Sample: compare results with the baseline.", status: "Blocked" },
      { personId: "lin", assignmentId: "A004", projectId: "P04", progress: "Sample: finished coding the next batch of field notes.", blockers: "", nextPlan: "Sample: review the coding with Jin.", status: "On track" },
      { personId: "serena", assignmentId: "A007", projectId: "P06", progress: "Sample: organized the literature review into three themes.", blockers: "", nextPlan: "", status: "On track" }
    ];
    globals.veLabDemo.updates = examples.map((u, i) => ({ ...u, id: `sample-${i}`, createdAt: new Date(now - (i + 1) * 86400000).toISOString() }));
  }
  return globals.veLabDemo;
}
export async function readStore(): Promise<Store> { return isDemo() ? structuredClone(demoStore()) : readSheet(); }
export async function addUpdate(update: Update) {
  if (isDemo()) { demoStore().updates.push(update); return; }
  return appendSheet("Updates", update);
}
export async function saveProject(project: Project) {
  if (isDemo()) { demoStore().projects = demoStore().projects.map(p => p.id === project.id ? project : p); return; }
  return replaceSheet("Projects", project);
}
export async function savePerson(person: Person) {
  if (isDemo()) { demoStore().people = demoStore().people.map(p => p.id === person.id ? person : p); return; }
  return replaceSheet("People", person);
}
export async function addPerson(person: Person) {
  if (isDemo()) { demoStore().people.push(person); return; }
  return appendSheet("People", person);
}
export async function saveAssignment(assignment: Assignment, exists: boolean) {
  if (isDemo()) {
    if (exists) demoStore().assignments = demoStore().assignments.map(a => a.id === assignment.id ? assignment : a);
    else demoStore().assignments.push(assignment);
    return;
  }
  return exists ? replaceSheet("Assignments", assignment) : appendSheet("Assignments", assignment);
}
export async function initializeStore() { return isDemo() ? readStore() : initializeSheet(structuredClone(seed) as Store); }
