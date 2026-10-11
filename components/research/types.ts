import type { Intervention, Run } from "@/lib/sim/types";

export type ResearchMode = "recorded" | "local" | "worker";

/** What the research desk reports to the campaign map each time the run, tick, resident or mode changes. */
export type ResearchFrame = {
  run: Run;
  tick: number;
  selected: string;
  mode: ResearchMode;
};

/** A run as the local worker reports it: on attach, on each stream message and in each command reply. */
export type WorkerRun = { run: Run; running: boolean; queued?: Intervention };
