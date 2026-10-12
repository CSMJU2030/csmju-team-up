import PublicProfile from "@/components/features/PublicProfile";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ coreUserId: string }> }) {
  const { coreUserId } = await params;
  return <PublicProfile coreUserId={coreUserId} />;
}
