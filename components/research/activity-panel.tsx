"use client";
import { ArrowUpRight, ChevronRight, ShieldAlert } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { scenarioLabel } from "@/lib/sim/scenario-label";
import type { Run } from "@/lib/sim/types";
import {
  boardEvents,
  feedEvents,
  incidentOutcome,
  nameIn,
  snapshotAt,
  visibleIncidents,
} from "./research-view-model";
import type { ResearchMode } from "./types";

/** The incident log, event feed and public board at the current tick. */
export function ActivityPanel({
  run,
  tick,
  mode,
  onJump,
  onToggle,
  onNew,
  onSelect,
  onEvidence,
}: {
  run: Run;
  tick: number;
  mode: ResearchMode;
  onJump: (tick: number) => void;
  onToggle: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onEvidence: (id: string) => void;
}) {
  const last = run.snapshots.length - 1;
  const agents = snapshotAt(run, tick).agents;
  const shown = visibleIncidents(run, tick);
  const latestClaim = shown.at(-1);
  return (
    <section className="activity-panel">
      <Tabs defaultValue="incidents">
        <div className="section-heading">
          <TabsList variant="line">
            <TabsTrigger value="incidents">
              Incident log <span className="count">{shown.length}</span>
            </TabsTrigger>
            <TabsTrigger value="events">Event feed</TabsTrigger>
            <TabsTrigger value="blackboard">Public board</TabsTrigger>
          </TabsList>
          <span className="muted-small">At tick {tick}</span>
        </div>
        <TabsContent value="incidents">
          {shown.length === 0 ? (
            <div className="quiet-state">
              <ShieldAlert size={25} />
              <h3>A quiet morning. For now.</h3>
              <p>
                {mode === "recorded" && last < 8
                  ? "This record ends before the first claim. Continue the village day in Council, or try a separate experiment."
                  : "The first claim is scheduled for tick 8. Play the run or jump to the incident."}
              </p>
              <button
                className="text-button"
                onClick={() => {
                  if (last >= 8) onJump(8);
                  else if (mode === "recorded") onNew();
                  else {
                    onToggle();
                  }
                }}
              >
                {mode === "recorded" && last < 8
                  ? "Try a new experiment"
                  : "Watch what happens"}{" "}
                <ArrowUpRight size={15} />
              </button>
            </div>
          ) : (
            shown
              .slice()
              .reverse()
              .map((i) => {
                const outcome = incidentOutcome(i, tick);
                return (
                  <button
                    className={`incident-card ${outcome === "succeeded" ? "harm" : ""}`}
                    key={i.id}
                    onClick={() => {
                      onSelect(i.target);
                      onEvidence(i.evidenceIds[0]);
                    }}
                  >
                    <span className="incident-time">
                      {String(i.tick).padStart(2, "0")}
                    </span>
                    <div>
                      <div className="incident-top">
                        <strong>
                          {scenarioLabel(i.family, run.definition)}
                        </strong>
                        <span className={`outcome ${outcome}`}>
                          {outcome === "pending"
                            ? "Under observation"
                            : outcome}
                        </span>
                      </div>
                      <p>{i.claim}</p>
                      <span className="incident-meta">
                        Rook → {agents.find((a) => a.id === i.target)?.name}
                        {outcome === "succeeded"
                          ? ` · ${i.harm} coin-equivalent harm`
                          : ""}
                        {i.detectedTick !== null && i.detectedTick <= tick
                          ? ` · Detected at tick ${i.detectedTick}`
                          : ""}
                      </span>
                    </div>
                    <ChevronRight size={16} />
                  </button>
                );
              })
          )}
        </TabsContent>
        <TabsContent value="events">
          <div className="event-feed">
            {feedEvents(run, tick).map((e) => (
              <button
                className="event-item"
                key={e.id}
                onClick={() => onEvidence(e.id)}
              >
                <span>{String(e.tick).padStart(2, "0")}</span>
                <div>
                  <strong>{e.title}</strong>
                  <p>{e.detail}</p>
                </div>
              </button>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="blackboard">
          <div className="public-board">
            <p>
              Attributed claims are public messages. They are not authoritative
              world facts.
            </p>
            {boardEvents(run, tick).map((e) => (
              <button
                className="board-note"
                key={e.id}
                onClick={() => onEvidence(e.id)}
              >
                <span>
                  Tick {e.tick} · {nameIn(agents, e.actor)}
                </span>
                <p>{e.detail}</p>
              </button>
            ))}
            {!latestClaim && (
              <p className="muted-small">No public claims posted yet.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
