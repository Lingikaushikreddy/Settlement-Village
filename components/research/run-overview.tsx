"use client";
import { ArrowUpRight, FlaskConical } from "lucide-react";
import { policyName } from "@/lib/sim/engine";
import { scenarioDescription } from "@/lib/sim/scenario-label";
import type { Run } from "@/lib/sim/types";
import { ResidentInspector } from "../resident-inspector";
import { nextIncidentEvent, snapshotAt } from "./research-view-model";
import type { ResearchMode } from "./types";

/** The run's scenario and policy with "Find an incident", the resident buttons and the selected resident's inspector. */
export function RunOverview({
  run,
  tick,
  mode,
  selected,
  onSelect,
  onJump,
  onEvidence,
  onNotice,
}: {
  run: Run;
  tick: number;
  mode: ResearchMode;
  selected: string;
  onSelect: (id: string) => void;
  onJump: (tick: number) => void;
  onEvidence: (id: string) => void;
  onNotice: (text: string) => void;
}) {
  const agents = snapshotAt(run, tick).agents;
  return (
    <>
      <div className="scenario-strip">
        <div className="scenario-icon">
          <FlaskConical size={20} />
        </div>
        <div>
          <strong>{run.name}</strong>
          <span>
            {scenarioDescription(run.config.scenario, run.definition)}
          </span>
        </div>
        <span className="policy-label">
          {policyName(run.config.policy, run.socialDecisions?.[0]?.model)}
        </span>
        <button
          className="text-button"
          onClick={() => {
            const e = nextIncidentEvent(run, tick);
            if (e) {
              onJump(e.tick);
              onSelect(e.target || "rook");
            } else
              onNotice(
                mode === "recorded"
                  ? "This village record ends before the first claim. Continue its day in Council, or create an experiment."
                  : "The first claim arrives at tick 8. Advance the simulation.",
              );
          }}
        >
          Find an incident <ArrowUpRight size={15} />
        </button>
      </div>
      <section className="world-layout">
        <div className="research-residents" aria-label="Research residents">
          {agents.map((a) => (
            <button
              key={a.id}
              aria-pressed={a.id === selected}
              onClick={() => onSelect(a.id)}
            >
              <i style={{ background: a.color }} />
              {a.name}
            </button>
          ))}
        </div>
        <ResidentInspector
          run={run}
          tick={tick}
          selected={selected}
          onEvidence={onEvidence}
        />
      </section>
    </>
  );
}
