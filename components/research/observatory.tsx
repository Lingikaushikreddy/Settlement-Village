"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Sprout,
  Play,
  ShieldAlert,
  ArrowUpRight,
  Download,
  CheckCircle2,
  Users,
  Library,
  ChevronRight,
} from "lucide-react";
import { Experiments, exportJson } from "../experiments";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { createRun, metrics, policyName, runToEnd } from "@/lib/sim/engine";
import { scenarioLabel } from "@/lib/sim/scenario-label";
import type { Run, Intervention } from "@/lib/sim/types";
import type { ResearchFrame } from "./types";
import { usePlayback } from "./use-playback";
import { useModelContextTools } from "./use-model-context";
import { useLocalWorker, type NewRunConfig } from "./use-local-worker";
import { NewExperimentDialog } from "./new-experiment-dialog";
import { EventDialog } from "./event-dialog";
import { FieldGuideDialog } from "./field-guide-dialog";
import { ResearchTabs } from "./research-tabs";
import { RunOverview } from "./run-overview";
import { PlaybackTimeline } from "./playback-timeline";
import { ModelReadiness } from "./model-readiness";
import {
  addToLibrary,
  boardEvents,
  feedEvents,
  incidentOutcome,
  nameIn,
  parseSavedLibrary,
  snapshotAt,
  visibleIncidents,
  wealthBars,
} from "./research-view-model";
export type { ResearchFrame } from "./types";
const STORAGE = "settlement-library-v1";
// Residents are shown by name; "village" and "observer" fall back to their label.
const defaultRun = () =>
  runToEnd({
    seed: 42,
    scenario: "scarcity",
    policy: "baseline",
    maxTicks: 60,
  });

export function Observatory({
  currentRun,
  section,
  onSection,
  selectedResident,
  onSelected,
  onFrame,
  onExit,
}: {
  currentRun: Run;
  section: string;
  onSection: (section: string) => void;
  selectedResident: string;
  onSelected: (id: string) => void;
  onFrame: (frame: ResearchFrame) => void;
  onExit: () => void;
}) {
  const playback = usePlayback(currentRun);
  const { run, tick, playing, mode, queued } = playback;
  const [newOpen, setNewOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [eventId, setEventId] = useState<string | null>(null),
    [notice, setNotice] = useState(""),
    [library, setLibrary] = useState<Run[]>([]);
  const selected = selectedResident,
    select = onSelected,
    view = section,
    setView = onSection;
  const worker = useLocalWorker({
    listRuns: view === "library" || newOpen,
    onRun: playback.receive,
    onNotice: setNotice,
  });
  useEffect(() => {
    onFrame({ run, tick, selected, mode });
  }, [run, tick, selected, mode, onFrame]);
  const last = run.snapshots.length - 1,
    w = snapshotAt(run, tick),
    m = metrics(run, tick);
  const shownIncidents = visibleIncidents(run, tick);
  const latestClaim = shownIncidents.at(-1);
  useEffect(() => {
    const hydrate = setTimeout(() => {
      let stored: { runs: Run[]; error: boolean };
      try {
        stored = parseSavedLibrary(localStorage.getItem(STORAGE));
      } catch {
        stored = { runs: [], error: true };
      }
      if (stored.error)
        setNotice(
          "Saved runs could not be read. You can still start a new simulation.",
        );
      else setLibrary(stored.runs);
    }, 0);
    return () => clearTimeout(hydrate);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const step =
    mode === "worker" ? () => void worker.command("step") : playback.step;
  function openRun(r: Run) {
    worker.detach();
    playback.openRecorded(r);
    setView("observatory");
    select("mira");
  }
  function save() {
    try {
      const next = addToLibrary(library, run);
      localStorage.setItem(STORAGE, JSON.stringify(next));
      setLibrary(next);
      setNotice(
        "Run saved to this browser. Export a copy to keep it elsewhere.",
      );
    } catch {
      setNotice("Browser storage is full. Use Export run to save a file.");
    }
  }
  async function start(config: NewRunConfig, useWorker: boolean) {
    if (useWorker) {
      if (!(await worker.create(config))) return;
    } else {
      worker.detach();
      playback.startLocal({
        ...createRun(config),
        id: `local-${crypto.randomUUID()}`,
      });
    }
    playback.resetCursor();
    setView("observatory");
    setNewOpen(false);
    select("mira");
  }
  function jump(t: number) {
    if (playback.current().mode === "worker") {
      setNotice("Save this worker run, then open its replay to rewind.");
      return;
    }
    playback.seek(t);
  }
  function toggle() {
    if (mode === "worker") {
      void worker.command(playing ? "pause" : "resume");
    } else playback.setPlaying(!playing);
  }
  function intervene(action: Intervention) {
    if (mode === "worker") {
      void worker.command("intervene", action);
    } else {
      playback.queue(action);
      setNotice("Intervention queued for the next new tick.");
    }
  }
  useModelContextTools(playback.current, jump);
  const wealth = useMemo(() => wealthBars(w), [w]);
  return (
    <section className="settlement unified-research">
      <ResearchTabs
        view={view}
        mode={mode}
        busy={worker.modelBusy}
        onExit={onExit}
        onView={(id) => {
          if (mode !== "worker") playback.setPlaying(false);
          setView(id);
        }}
        onNew={() => setNewOpen(true)}
        onHelp={() => setHelpOpen(true)}
      />
      {view === "observatory" && (
        <>
          <RunOverview
            run={run}
            tick={tick}
            mode={mode}
            selected={selected}
            onSelect={select}
            onJump={jump}
            onEvidence={setEventId}
            onNotice={setNotice}
          />
          <PlaybackTimeline
            playback={playback}
            busy={worker.modelBusy}
            onJump={jump}
            onToggle={toggle}
            onStep={step}
            onIntervene={intervene}
            onSave={save}
            onNotice={setNotice}
          />
          <ModelReadiness
            run={run}
            tick={tick}
            mode={mode}
            playing={playing}
            queued={!!queued}
            provider={worker.provider}
            busy={worker.modelBusy}
            onAsk={() => void worker.modelStep()}
          />
          <div className="lower-grid">
            <section className="activity-panel">
              <Tabs defaultValue="incidents">
                <div className="section-heading">
                  <TabsList variant="line">
                    <TabsTrigger value="incidents">
                      Incident log{" "}
                      <span className="count">{shownIncidents.length}</span>
                    </TabsTrigger>
                    <TabsTrigger value="events">Event feed</TabsTrigger>
                    <TabsTrigger value="blackboard">Public board</TabsTrigger>
                  </TabsList>
                  <span className="muted-small">At tick {tick}</span>
                </div>
                <TabsContent value="incidents">
                  {shownIncidents.length === 0 ? (
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
                          if (last >= 8) jump(8);
                          else if (mode === "recorded") setNewOpen(true);
                          else {
                            toggle();
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
                    shownIncidents
                      .slice()
                      .reverse()
                      .map((i) => {
                        const outcome = incidentOutcome(i, tick);
                        return (
                          <button
                            className={`incident-card ${outcome === "succeeded" ? "harm" : ""}`}
                            key={i.id}
                            onClick={() => {
                              select(i.target);
                              setEventId(i.evidenceIds[0]);
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
                                Rook →{" "}
                                {w.agents.find((a) => a.id === i.target)?.name}
                                {outcome === "succeeded"
                                  ? ` · ${i.harm} coin-equivalent harm`
                                  : ""}
                                {i.detectedTick !== null &&
                                i.detectedTick <= tick
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
                        onClick={() => setEventId(e.id)}
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
                      Attributed claims are public messages. They are not
                      authoritative world facts.
                    </p>
                    {boardEvents(run, tick).map((e) => (
                      <button
                        className="board-note"
                        key={e.id}
                        onClick={() => setEventId(e.id)}
                      >
                        <span>
                          Tick {e.tick} · {nameIn(w.agents, e.actor)}
                        </span>
                        <p>{e.detail}</p>
                      </button>
                    ))}
                    {!latestClaim && (
                      <p className="muted-small">
                        No public claims posted yet.
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </section>
            <aside className="metrics-panel">
              <div className="section-heading">
                <h3>State of the village</h3>
                <Sprout size={18} />
              </div>
              <div className="metric-pair">
                <div>
                  <strong>
                    {m.resistance === null ? "—" : `${m.resistance}%`}
                  </strong>
                  <span>Behavioral resistance</span>
                  <small>
                    {m.resisted} / {m.evaluable} evaluable attacks
                  </small>
                </div>
                <div>
                  <strong>{m.harm}</strong>
                  <span>Scenario harm</span>
                  <small>Coin-equivalent · {m.pending} pending</small>
                </div>
              </div>
              <div className="wealth-heading">
                <span>Resident coin balances</span>
                <CoinsLegend />
              </div>
              <div className="wealth-chart">
                {wealth.map((a) => (
                  <div key={a.name}>
                    <span>{a.name}</span>
                    <div>
                      <i
                        style={{
                          width: `${a.width}%`,
                          background: a.color,
                        }}
                      />
                    </div>
                    <strong>{a.coins}</strong>
                  </div>
                ))}
              </div>
              <button
                className="text-button"
                onClick={() => setView("experiments")}
              >
                Compare decision policies <ArrowUpRight size={15} />
              </button>
            </aside>
          </div>
        </>
      )}
      {view === "experiments" && <Experiments onOpen={openRun} />}
      {view === "library" && (
        <section className="library-panel">
          <div className="section-heading">
            <div>
              <h2>Your run library</h2>
              <p>Saved in this browser. Export a file for a durable copy.</p>
            </div>
            <Library size={26} />
          </div>
          <article className="library-feature">
            <span className="feature-icon">
              <Users size={28} />
            </span>
            <div>
              <span className="muted-small">From your playable village</span>
              <h3>{currentRun.name}</h3>
              <p>
                Chapter record · {currentRun.snapshots.length - 1} ticks ·
                village progress preserved
              </p>
            </div>
            <button className="primary" onClick={() => openRun(currentRun)}>
              Inspect village record
            </button>
          </article>
          <article className="library-feature">
            <span className="feature-icon">
              <Sprout size={32} />
            </span>
            <div>
              <span className="muted-small">Included reference run</span>
              <h3>The Missing Grain</h3>
              <p>Seed 42 · Trust first · 60 ticks</p>
            </div>
            <button className="primary" onClick={() => openRun(defaultRun())}>
              <Play size={14} />
              Open replay
            </button>
          </article>
          {worker.available && worker.runs.length > 0 && (
            <div className="worker-library">
              <h3>On your local worker</h3>
              <p className="muted-small">
                Stored in SQLite. Resume across page reloads and worker
                restarts.
              </p>
              {worker.runs.map((r) => (
                <article className="library-row" key={r.id}>
                  <div>
                    <h3>{r.name}</h3>
                    <p>
                      Tick {r.tick} · {r.running ? "Running" : "Paused"}
                    </p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() =>
                      void worker
                        .open(r.id)
                        .then((ok) => ok && setView("observatory"))
                    }
                  >
                    Connect to run
                  </button>
                </article>
              ))}
            </div>
          )}
          {library.length === 0 ? (
            <div className="quiet-state">
              <Library size={24} />
              <h3>A place for your discoveries.</h3>
              <p>
                Choose “Save run” in the observatory to keep a simulation here.
              </p>
            </div>
          ) : (
            library.map((r) => (
              <article className="library-row" key={r.id}>
                <div>
                  <h3>{r.name}</h3>
                  <p>
                    Seed {r.config.seed} · {policyName(r.config.policy)} ·{" "}
                    {r.snapshots.length - 1} ticks
                  </p>
                </div>
                <button className="secondary" onClick={() => openRun(r)}>
                  Open replay
                </button>
                <button
                  className="icon-button"
                  aria-label={`Export ${r.name}`}
                  onClick={() => exportJson(r, `${r.id}.json`)}
                >
                  <Download size={16} />
                </button>
              </article>
            ))
          )}
        </section>
      )}
      <footer className="site-footer">
        <span>
          Settlement <span className="footer-leaf">✳</span> A village of
          choices.
        </span>
        <span>Built to be observed. Designed to be questioned.</span>
      </footer>
      <NewExperimentDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        workerAvailable={worker.available}
        onStart={start}
        onNotice={setNotice}
      />
      <EventDialog
        run={run}
        tick={tick}
        eventId={eventId}
        onClose={() => setEventId(null)}
        onJump={jump}
        onSelect={select}
      />
      <FieldGuideDialog open={helpOpen} onOpenChange={setHelpOpen} />
      {notice && (
        <div className="notice" role="status">
          <CheckCircle2 size={17} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
    </section>
  );
}
function CoinsLegend() {
  return <span className="muted-small">coins</span>;
}
