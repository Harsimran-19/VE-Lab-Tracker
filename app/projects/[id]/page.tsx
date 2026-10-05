import { WorkspacePage } from "@/components/workspace-page";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  return (
    <WorkspacePage
      screen="project"
      projectId={(await params).id}
      {...await searchParams}
    />
  );
}
