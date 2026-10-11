"use client";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { crewCommand } from "@/lib/game/crew";
import {
  councilCommand,
  councilResearchRun,
  newCouncil,
} from "@/lib/game/council";
import type { Game } from "@/lib/game/model";
import type { Run } from "@/lib/sim/types";
import type { ResearchFrame } from "../research/types";
import { displayedResearch, researchCaption } from "./campaign-view-model";

const Research = lazy(() =>
  import("../research/observatory").then((m) => ({ default: m.Observatory })),
);

export type ResearchDesk = {
  research: { run: Run; section: string } | null;
  frame: ResearchFrame | null;
  /** The run and tick the map shows: the live frame, else the research run, else the council run. */
  displayed: { run: Run; tick: number };
  open: (section?: string) => void;
  setSection: (section: string) => void;
  close: () => void;
  setFrame: (frame: ResearchFrame) => void;
};

/**
 * Owns the research desk's state: which run and section are open, the frame the
 * Observatory reports back, and opening from the URL (`view`, `seed`, `report`).
 * `onOpen` lets the composer close its own panels; it must be a stable callback.
 */
export function useResearchDesk(
  campaign: {
    game: Game;
    update: (fn: (g: Game) => Game) => boolean;
    latest: () => Game;
  },
  onOpen: () => void,
): ResearchDesk {
  const { game, update, latest } = campaign;
  const [research, setResearch] = useState<{
    run: Run;
    section: string;
  } | null>(null);
  const [frame, setFrame] = useState<ResearchFrame | null>(null);
  const open = useCallback(
    (section = "observatory") => {
      if (latest().battle) return;
      update((g) =>
        councilCommand(g.crew ? crewCommand(g, { type: "pause" }) : g, {
          type: "pause",
        }),
      );
      setResearch((r) =>
        r
          ? { ...r, section }
          : {
              run: councilResearchRun(latest().council ?? newCouncil()),
              section,
            },
      );
      onOpen();
    },
    [update, latest, onOpen],
  );
  const setSection = useCallback(
    (section: string) => setResearch((r) => r && { ...r, section }),
    [],
  );
  const close = useCallback(() => {
    setResearch(null);
    setFrame(null);
  }, []);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (
      q.has("seed") ||
      q.has("report") ||
      ["research", "archive"].includes(q.get("view") ?? "")
    ) {
      const timer = setTimeout(
        () =>
          open(
            q.get("view") === "archive"
              ? "library"
              : q.has("report")
                ? "experiments"
                : "observatory",
          ),
        0,
      );
      return () => clearTimeout(timer);
    }
  }, [open]);
  return {
    research,
    frame,
    displayed: displayedResearch(frame, research, game),
    open,
    setSection,
    close,
    setFrame,
  };
}

/** The research desk over the map: caption for the displayed run and the lazily loaded Observatory. */
export function ResearchOverlay({
  desk,
  resident,
  onResident,
}: {
  desk: ResearchDesk;
  resident: string;
  onResident: (id: string) => void;
}) {
  if (!desk.research) return null;
  return (
    <>
      <div className="research-map-caption">
        <strong>{desk.displayed.run.name}</strong>
        <span>
          Tick {desk.displayed.tick} · {researchCaption(desk.frame?.mode)}
        </span>
        <p>Select a resident on the map to follow their decisions.</p>
      </div>
      <aside className="unified-workbench" aria-label="Village research desk">
        <Suspense
          fallback={
            <p className="research-loading">Opening the village records…</p>
          }
        >
          <Research
            currentRun={desk.research.run}
            section={desk.research.section}
            onSection={desk.setSection}
            selectedResident={resident}
            onSelected={onResident}
            onFrame={desk.setFrame}
            onExit={desk.close}
          />
        </Suspense>
      </aside>
    </>
  );
}
