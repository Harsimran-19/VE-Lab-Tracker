import { authorizedContext, loginIdentity } from "@/lib/auth";
import { isDemo, missingConfig } from "@/lib/config";
import { Login } from "@/components/login";
import { InvitationAccept } from "@/components/invitations";

export default async function InvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const missing = isDemo() ? [] : missingConfig();
  if (missing.length || !(await loginIdentity())) return <Login missing={missing} callbackUrl={`/invite/${encodeURIComponent(id)}`} />;
  const { identity, store } = await authorizedContext();
  const invitation = store.invitations.find(i => i.id === id && i.email === identity.email);
  return <InvitationAccept id={id} email={identity.email} available={Boolean(invitation && !invitation.revokedAt && (invitation.acceptedAt || invitation.expiresAt > new Date().toISOString()))} projectName={store.projects.find(p => p.id === invitation?.projectId)?.name} />;
}
