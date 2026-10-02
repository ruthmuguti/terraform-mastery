"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store";
import { MISSIONS, getChapters, CHAPTER_NAMES } from "@/data/missions";
import { TopBar } from "@/components/layout/TopBar";
import { MissionCard } from "@/components/missions/MissionCard";
import { Map } from "lucide-react";

export default function MissionsPage() {
  const router = useRouter();
  const profile = useGameStore((s) => s.profile);
  const missionProgress = useGameStore((s) => s.missionProgress);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !profile) router.replace("/");
  }, [profile, mounted, router]);

  if (!mounted || !profile) return null;

  const chapters = getChapters();

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-y-auto">
      <TopBar
        title="Mission Select"
        subtitle={`${profile.completedMissions.length} of ${MISSIONS.length} operations completed`}
      />

      <div className="flex-1 p-6 max-w-5xl">
        {/* Chapter legend */}
        <div className="flex items-center gap-2 mb-6">
          <Map className="w-4 h-4 text-terminal" />
          <span className="text-xs font-mono text-text-muted tracking-widest">OPERATIONS MAP</span>
        </div>

        <div className="space-y-10">
          {chapters.map(({ chapter, missions }) => {
            const completedInChapter = missions.filter((m) =>
              profile.completedMissions.includes(m.id)
            ).length;

            return (
              <div key={chapter}>
                {/* Chapter header */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded border border-terminal/30 bg-terminal/5 flex items-center justify-center text-xs font-mono font-bold text-terminal">
                      {chapter}
                    </div>
                    <div>
                      <div className="font-mono font-bold text-text-primary text-sm">
                        Chapter {chapter} — {CHAPTER_NAMES[chapter]}
                      </div>
                      <div className="text-xs font-mono text-text-muted">
                        {completedInChapter}/{missions.length} complete
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 h-px bg-noir-500" />
                  <div className="text-xs font-mono text-text-muted">
                    {Math.round((completedInChapter / missions.length) * 100)}%
                  </div>
                </div>

                {/* Mission cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {missions.map((mission) => (
                    <MissionCard
                      key={mission.id}
                      mission={mission}
                      progress={missionProgress[mission.id]}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
