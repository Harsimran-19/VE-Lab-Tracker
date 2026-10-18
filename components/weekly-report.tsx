"use client";
import Link from "next/link";
import { type Project, type Update, type Workspace } from "@/lib/types";
import { shortDate } from "@/lib/format";
import { LinkList } from "./link-list";

const MEETING_LABELS = { none: "No meeting", scheduled: "Scheduled", held: "Met" } as const;
export function meetingText(state: Update["piMeeting"], date?: string) {
  if (!state) return "";
  return `${MEETING_LABELS[state]}${date && state !== "none" ? ` · ${shortDate(date)}` : ""}`;
}
export const hoursOf = (u: Pick<Update, "hours">) => (u.hours ? Number(u.hours) || 0 : 0);
export const formatHours = (hours: number) => `${Math.round(hours * 100) / 100} h`;

// Hours, meetings and reference files recorded with a weekly report.
export function ReportExtras({ update }: { update: Update }) {
  const pi = meetingText(update.piMeeting, update.piMeetingDate);
  const collaborators = meetingText(update.collaboratorMeeting, update.collaboratorMeetingDate);
  if (!update.hours && !pi && !collaborators && !update.meetingNotes && !update.files?.length) return null;
  return <dl className="report-extras">
    {update.hours !== undefined && update.hours !== "" && <div><dt>Hours this week</dt><dd>{formatHours(hoursOf(update))}</dd></div>}
    {pi && <div><dt>Meeting with the PI</dt><dd>{pi}</dd></div>}
    {collaborators && <div><dt>External collaborators</dt><dd>{collaborators}{update.collaboratorNames ? ` · ${update.collaboratorNames}` : ""}</dd></div>}
    {update.meetingNotes && <div className="report-extras-wide"><dt>Meeting notes</dt><dd>{update.meetingNotes}</dd></div>}
    {!!update.files?.length && <div className="report-extras-wide"><dt>Reference files</dt><dd><LinkList links={update.files} /></dd></div>}
  </dl>;
}

export function HoursSummary({ project, data }: { project: Project; data: Workspace }) {
  const reports = data.updates.filter(u => u.projectId === project.id && u.hours);
  if (!reports.length) return null;
  const people = [...new Set(reports.map(u => u.personId))];
  const total = (personId: string, week?: string) => reports.filter(u => u.personId === personId && (!week || u.weekStart === week)).reduce((sum, u) => sum + hoursOf(u), 0);
  return <section className="panel hours-summary" aria-label="Weekly hours">
    <h2>Weekly hours</h2>
    <table className="directory-table"><thead><tr><th>Member</th><th>This week</th><th>All weeks</th></tr></thead><tbody>
      {people.map(id => <tr key={id}><td data-label="Member"><Link href={`/team/${id}`} prefetch={false}>{data.people.find(p => p.id === id)?.name || "Former member"}</Link></td><td data-label="This week">{formatHours(total(id, data.weekStart))}</td><td data-label="All weeks">{formatHours(total(id))}</td></tr>)}
    </tbody><tfoot><tr><td>Project total</td><td>{formatHours(people.reduce((s, id) => s + total(id, data.weekStart), 0))}</td><td>{formatHours(people.reduce((s, id) => s + total(id), 0))}</td></tr></tfoot></table>
  </section>;
}
