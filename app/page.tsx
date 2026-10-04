import { Login } from "@/components/login";
import { LabApp } from "@/components/lab-app";
import { authorizedContext, loginIdentity } from "@/lib/auth";
import { adminEmails, isDemo, missingConfig } from "@/lib/config";
import { workspaceFor, AppError } from "@/lib/access";

export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const missing = isDemo() ? [] : missingConfig();
  if (missing.length || !(await loginIdentity())) return <Login missing={missing} error={params.error}/>;
  try {
    const { identity, store } = await authorizedContext();
    return <LabApp initial={workspaceFor(store, identity, isDemo(), adminEmails())}/>;
  } catch (error) {
    return <main className="service-error"><div><p className="eyebrow">VE LAB</p><h1>Let’s reconnect your workspace.</h1><p>{error instanceof AppError ? error.message : "The Google connection could not be completed. Check the service-account credentials and spreadsheet sharing settings."}</p><a className="button primary" href="/">Try again</a><p className="muted">Your existing research records remain in Google Sheets.</p></div></main>;
  }
}
