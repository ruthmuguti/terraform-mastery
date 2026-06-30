import { notFound } from "next/navigation";
import { getMission } from "@/data/missions";
import { MissionPageClient } from "./MissionPageClient";

export default async function MissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Validate mission exists server-side (triggers 404 if not)
  if (!getMission(id)) notFound();

  // Pass only the ID — functions in Mission.objectives.check cannot
  // be serialized across the server/client boundary.
  return <MissionPageClient missionId={id} />;
}
