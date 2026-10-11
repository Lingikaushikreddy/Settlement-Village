"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Sprout,
  Play,
  Pause,
  StepForward,
  RotateCcw,
  ShieldAlert,
  FlaskConical,
  ArrowUpRight,
  Download,
  Plus,
  BookOpen,
  CheckCircle2,
  Users,
  Library,
  ChevronRight,
  Activity,
  Server,
  Sparkles,
} from "lucide-react";
import { ResidentInspector } from "../resident-inspector";
import { Experiments, exportJson } from "../experiments";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  createRun,
  metrics,
  policyInfo,
  policyName,
  runToEnd,
  scenarioInfo,
  verifyReplay,
} from "@/lib/sim/engine";
import { scenarioDescription, scenarioLabel } from "@/lib/sim/scenario-label";
import type {
  BuiltInPolicy,
  Run,
  Scenario,
  Intervention,
} from "@/lib/sim/types";
import type { ResearchFrame } from "./types";
import { usePlayback } from "./use-playback";
import { useModelContextTools } from "./use-model-context";
import { useLocalWorker, workerOrigin } from "./use-local-worker";
import {
  addToLibrary,
  boardEvents,
  canAskModel,
  feedEvents,
  incidentEvents,
  incidentOutcome,
  modeLabel,
  nameIn,
  nextIncidentEvent,
  parseSavedLibrary,
  parseSeed,
  playbackStatus,
  researchHeading,
  snapshotAt,
  visibleIncidents,
  wealthBars,
} from "./research-view-model";
export type { ResearchFrame } from "./types";
const STORAGE = "settlement-library-v1";
const noSubscription = () => () => {};
// Residents are shown by name; "village" and "observer" fall back to their label.
const RUN_LOCALLY =
  "https://github.com/Lingikaushikreddy/Settlement-Village#run-locally";
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
  const { run, tick, playing, speed, mode, queued } = playback;
  const [newOpen, setNewOpen] = useState(false),
    [starting, setStarting] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [eventId, setEventId] = useState<string | null>(null),
    [notice, setNotice] = useState(""),
    [library, setLibrary] = useState<Run[]>([]),
    [draftScenario, setDraftScenario] = useState<Scenario>("scarcity"),
    [draftPolicy, setDraftPolicy] = useState<BuiltInPolicy>("baseline"),
    [draftSeed, setDraftSeed] = useState("42");
  const hosted = useSyncExternalStore(
    noSubscription,
    () => !workerOrigin(),
    () => false,
  );
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
  const claimEvents = incidentEvents(run);
  const shownIncidents = visibleIncidents(run, tick);
  const activeEvent = run.events.find((e) => e.id === eventId);
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
  async function start(useWorker = false) {
    const seed = parseSeed(draftSeed);
    if (seed === null) {
      setNotice("Choose a whole-number seed from 0 to 999999.");
      return;
    }
    setStarting(true);
    const config = {
      seed,
      scenario: draftScenario,
      policy: draftPolicy,
      maxTicks: 60,
    };
    try {
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
    } finally {
      setStarting(false);
    }
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
      <header className="research-heading">
        <div>
          <span>Settlement / research desk</span>
          <h2>{researchHeading(view)}</h2>
        </div>
        <button
          className="research-close"
          onClick={onExit}
          aria-label="Close research and return to village"
        >
          ×
        </button>
      </header>
      <div className="research-tabs">
        <nav aria-label="Research tools">
          {[
            ["observatory", "Inspect"],
            ["experiments", "Compare"],
            ["library", "Archive"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={view === id}
              disabled={worker.modelBusy}
              onClick={() => {
                if (mode !== "worker") playback.setPlaying(false);
                setView(id);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <button
          className="primary"
          disabled={worker.modelBusy}
          onClick={() => setNewOpen(true)}
        >
          <Plus size={15} /> New experiment
        </button>
      </div>
      <button
        className="text-button research-help"
        onClick={() => setHelpOpen(true)}
      >
        <BookOpen size={14} /> Research field guide
      </button>
      <div className="research-boundary">
        <ShieldAlert size={16} />
        <span>{modeLabel(mode)} · village resources stay unchanged</span>
      </div>
      {view === "observatory" && (
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
                  jump(e.tick);
                  select(e.target || "rook");
                } else
                  setNotice(
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
              {w.agents.map((a) => (
                <button
                  key={a.id}
                  aria-pressed={a.id === selected}
                  onClick={() => select(a.id)}
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
              onEvidence={(id) => setEventId(id)}
            />
          </section>
          <section className="timeline" aria-label="Simulation playback">
            <div className="transport">
              <button
                className="icon-button"
                aria-label="Rewind to beginning"
                disabled={mode === "worker"}
                onClick={() => jump(0)}
              >
                <RotateCcw size={16} />
              </button>
              <button
                className="play-button"
                aria-label={playing ? "Pause" : "Play"}
                onClick={toggle}
                disabled={
                  worker.modelBusy ||
                  (mode === "recorded" && last === 0) ||
                  (tick === last &&
                    run.status === "completed" &&
                    mode !== "recorded")
                }
              >
                {playing ? (
                  <Pause size={16} fill="currentColor" />
                ) : (
                  <Play size={16} fill="currentColor" />
                )}
              </button>
              <button
                className="icon-button"
                aria-label="Advance one tick"
                onClick={step}
                disabled={
                  (tick === last &&
                    (run.status === "completed" || mode === "recorded")) ||
                  (mode === "worker" && playing) ||
                  worker.modelBusy
                }
              >
                <StepForward size={18} />
              </button>
            </div>
            <div className="timeline-track">
              <div className="tick-label">
                <strong>Tick {tick.toString().padStart(2, "0")}</strong>
                <span>
                  {run.config.maxTicks} ticks ·{" "}
                  {playbackStatus(run, tick, playing)}
                </span>
              </div>
              <Slider
                aria-label="Playback tick"
                min={0}
                max={Math.max(last, 1)}
                value={[tick]}
                onValueChange={(v) => jump(v[0])}
                disabled={last === 0 || mode === "worker" || worker.modelBusy}
              />
              <div className="incident-markers">
                {claimEvents.map((e) => (
                  <button
                    key={e.id}
                    aria-label={`Go to incident at tick ${e.tick}`}
                    title={`Incident at tick ${e.tick}`}
                    onClick={() => jump(e.tick)}
                    style={{ left: `${(e.tick / Math.max(last, 1)) * 100}%` }}
                  />
                ))}
              </div>
            </div>
            <Select value={speed} onValueChange={playback.setSpeed}>
              <SelectTrigger
                aria-label="Playback speed"
                disabled={mode === "worker"}
                className="speed-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["1", "2", "4"].map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}× speed
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button className="secondary save-run" onClick={save}>
              Save run
            </button>
          </section>
          <div className="run-toolbar">
            <span>
              <Activity size={14} />
              {run.modelCalls
                ? "Model-assisted decisions"
                : "Rule-based decisions"}{" "}
              · {run.modelCalls} model calls · ${run.estimatedCost.toFixed(4)}{" "}
              estimated API cost
            </span>
            <div>
              {mode !== "recorded" && run.status === "active" && (
                <Select
                  value=""
                  disabled={worker.modelBusy}
                  onValueChange={(v) => intervene(v as Intervention)}
                >
                  <SelectTrigger aria-label="Intervene in simulation">
                    <SelectValue
                      placeholder={queued ? "Intervention queued" : "Intervene"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add-grain">Add 12 grain</SelectItem>
                    <SelectItem value="publish-stock">
                      Publish verified stock
                    </SelectItem>
                    <SelectItem value="pause-chaos">
                      Stop future Chaos attempts
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
              <button
                className="text-button"
                onClick={() => exportJson(run, `${run.id}.json`)}
              >
                <Download size={14} />
                Export run
              </button>
              <button
                className="text-button"
                onClick={() => {
                  const result = verifyReplay(run);
                  setNotice(
                    result.ok
                      ? "Replay verified: every checkpoint matches."
                      : result.reason,
                  );
                }}
              >
                <CheckCircle2 size={14} />
                Verify replay
              </button>
            </div>
          </div>
          <section className="model-readiness">
            <div>
              <Sparkles size={20} />
              <span>
                <strong>Live model decisions</strong>
                <small>
                  {worker.provider?.reason ??
                    (hosted ? (
                      <>
                        You&apos;re playing the hosted demo. Free simulations,
                        comparisons and replays run here in your browser.
                        Live-model experiments need the optional local worker —
                        see{" "}
                        <a href={RUN_LOCALLY} target="_blank" rel="noreferrer">
                          Run locally
                        </a>
                        .
                      </>
                    ) : (
                      "Free policies are active. Start the optional local worker to configure model decisions."
                    ))}
                </small>
              </span>
            </div>
            {worker.provider?.ready && (
              <p>
                {worker.provider.model} · daily budget $
                {worker.provider.dailyBudgetUSD} · six requests per run maximum.
                Each model step sends this recipient’s visible evidence to
                Claude and may incur API cost.
              </p>
            )}
            <button
              className="secondary"
              disabled={
                !canAskModel({
                  ready: !!worker.provider?.ready,
                  mode,
                  playing,
                  queued: !!queued,
                  busy: worker.modelBusy,
                  run,
                  tick,
                })
              }
              onClick={() => void worker.modelStep()}
            >
              <Sparkles size={15} />
              {worker.modelBusy
                ? "Evaluating the next decision…"
                : "Ask Claude to decide next tick"}
            </button>
            {mode !== "worker" && (
              <small>
                Create an experiment on the local worker to use configured model
                decisions.
              </small>
            )}
            {run.socialDecisions
              ?.filter((d) => d.tick <= tick)
              .map((d) => (
                <details key={`${d.tick}-${d.actor}`}>
                  <summary>
                    Tick {d.tick} · {nameIn(w.agents, d.actor)} ·{" "}
                    {d.action === "invalid"
                      ? `no valid answer (${d.invalidReason?.replaceAll("_", " ") ?? "invalid"})`
                      : d.action.replaceAll("_", " ")}{" "}
                    ·{" "}
                    {run.config.policy === "external"
                      ? `${d.model} decision`
                      : "model proposal"}
                  </summary>
                  {d.summary && <p>{d.summary}</p>}
                  {d.evidenceIds.length > 0 && (
                    <small>Cited evidence: {d.evidenceIds.join(", ")}</small>
                  )}
                  {run.config.policy !== "external" && (
                    <small>
                      {d.model} · {d.usage.inputTokens} input /{" "}
                      {d.usage.outputTokens} output tokens · $
                      {d.costUSD.toFixed(4)} estimated
                    </small>
                  )}
                </details>
              ))}
          </section>
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
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="new-run-dialog">
          <DialogHeader>
            <DialogTitle>Start a new simulation</DialogTitle>
            <DialogDescription>
              Seven agents. One village. A new set of choices.
            </DialogDescription>
          </DialogHeader>
          <div className="form-field">
            <label>Scenario</label>
            <Select
              value={draftScenario}
              onValueChange={(v) => setDraftScenario(v as Scenario)}
            >
              <SelectTrigger aria-label="New run scenario">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(scenarioInfo).map(([id, s]) => (
                  <SelectItem key={id} value={id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p>{scenarioDescription(draftScenario)}</p>
          </div>
          <div className="form-field">
            <label>Resident policy</label>
            <Select
              value={draftPolicy}
              onValueChange={(v) => setDraftPolicy(v as BuiltInPolicy)}
            >
              <SelectTrigger aria-label="New run policy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(policyInfo).map(([id, p]) => (
                  <SelectItem key={id} value={id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p>{policyInfo[draftPolicy].description}</p>
          </div>
          <div className="form-field">
            <label htmlFor="seed">World seed</label>
            <input
              id="seed"
              type="number"
              min="0"
              max="999999"
              value={draftSeed}
              onChange={(e) => setDraftSeed(e.target.value)}
            />
            <p>Matching seeds reproduce the same starting conditions.</p>
          </div>
          <div className="simulation-note">
            <CheckCircle2 size={17} />
            <span>No paid AI calls. Runs for 60 ticks in this browser.</span>
          </div>
          <button
            className="primary"
            disabled={starting}
            onClick={() => void start()}
          >
            <Play size={16} />
            Create simulation
          </button>
          {worker.available && (
            <button
              className="secondary"
              disabled={starting}
              onClick={() => void start(true)}
            >
              <Server size={16} />
              Create on local worker
            </button>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!activeEvent} onOpenChange={(v) => !v && setEventId(null)}>
        <DialogContent className="evidence-dialog">
          <DialogHeader>
            <DialogTitle>{activeEvent?.title}</DialogTitle>
            <DialogDescription>
              Recorded evidence · tick {activeEvent?.tick} · {activeEvent?.id}
            </DialogDescription>
          </DialogHeader>
          <blockquote>{activeEvent?.detail}</blockquote>
          <dl className="evidence-details">
            <div>
              <dt>Source</dt>
              <dd>{activeEvent?.actor}</dd>
            </div>
            <div>
              <dt>Visibility</dt>
              <dd>
                {activeEvent?.visibility === "public"
                  ? "Public message"
                  : "Scoped observation"}
              </dd>
            </div>
            <div>
              <dt>Observed by</dt>
              <dd>{activeEvent?.audience.join(", ")}</dd>
            </div>
          </dl>
          <p className="muted-small">
            Statements are attributed to their source. A recorded claim is not
            proof that the statement is true.
          </p>
          <button
            className="primary"
            onClick={() => {
              if (activeEvent) {
                jump(activeEvent.tick);
                if (w.agents.some((a) => a.id === activeEvent.actor))
                  select(activeEvent.actor);
              }
              setEventId(null);
            }}
          >
            Go to this tick <ArrowUpRight size={15} />
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="guide-dialog">
          <DialogHeader>
            <DialogTitle>A field guide to Settlement</DialogTitle>
            <Link href="/gallery">See the gallery of verified reports</Link>
            <DialogDescription>
              Observe → investigate → intervene → compare.
            </DialogDescription>
          </DialogHeader>
          <p>
            Residents plan meals, gather resources, and trade. Rook introduces
            fixed adversarial claims. Policies decide whether to trust, refuse,
            or inspect.
          </p>
          <ol>
            <li>
              <strong>Watch.</strong> Play a recorded run or start your own
              simulation.
            </li>
            <li>
              <strong>Investigate.</strong> Select a resident, inspect their
              memories, and follow source evidence.
            </li>
            <li>
              <strong>Intervene.</strong> In a new simulation, publish stock
              evidence, add grain, or stop future attacks.
            </li>
            <li>
              <strong>Compare.</strong> Test the same seeds under three
              policies, including honest-offer controls.
            </li>
          </ol>
          <p className="guide-limit">
            Free runs use deterministic rules. Configured local worker runs can
            apply explicitly requested Claude decisions. Results illustrate
            these scenarios; they do not establish general agent safety. Browser
            runs advance while this page is open. The optional local worker
            persists and advances independently.
          </p>
        </DialogContent>
      </Dialog>
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
