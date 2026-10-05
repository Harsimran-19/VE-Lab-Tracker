import { WorkspacePage } from "@/components/workspace-page";
export const dynamic = "force-dynamic";
export default async function Page({ params }: {
  params: Promise<{ id: string }>;
}) {
  return <WorkspacePage screen="member" personId={(await params).id} />;
}
