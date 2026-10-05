import { WorkspacePage } from "@/components/workspace-page";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  return <WorkspacePage screen="projects" {...await searchParams} />;
}
