import ProjectProgress from "@/components/features/ProjectProgress";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectProgress projectId={projectId} />;
}
