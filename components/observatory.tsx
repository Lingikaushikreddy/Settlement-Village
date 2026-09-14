"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Sprout,
  Play,
  Pause,
  StepForward,
  RotateCcw,
  Users,
  ShieldAlert,
  FlaskConical,
  ArrowUpRight,
  Download,
  Plus,
  BookOpen,
  CheckCircle2,
  Clock,
  Radio,
  Library,
  ChevronRight,
  Activity,
  Server,
} from "lucide-react";
import Link from "next/link";
import { VillageMap } from "./village-map";
import { ResidentInspector } from "./resident-inspector";
import { Experiments, exportJson } from "./experiments";
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
  advance,
  createRun,
  ENGINE_VERSION,
  metrics,
  policyInfo,
  runToEnd,
  scenarioInfo,
  verifyReplay,
} from "@/lib/sim/engine";
import type { Run, Scenario, Policy, Intervention } from "@/lib/sim/types";
const STORAGE = "settlement-library-v1";
const defaultRun = () =>
  runToEnd({
    seed: 42,
    scenario: "scarcity",
    policy: "baseline",
    maxTicks: 60,
  });
function validateSaved(x: unknown): x is Run {
  return (
    !!x &&
    typeof x === "object" &&
    (x as Run).schemaVersion === 1 &&
    (x as Run).engineVersion === ENGINE_VERSION &&
    Array.isArray((x as Run).snapshots) &&
    (x as Run).snapshots.length <= 151 &&
    Array.isArray((x as Run).events) &&
    Array.isArray((x as Run).incidents) &&
    !!(x as Run).config
  );
}
export function Observatory() {
  const [run, setRun] = useState<Run>(defaultRun),
    [tick, setTick] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState("1"),
    [selected, select] = useState("mira"),
    [view, setView] = useState("observatory"),
    [mode, setMode] = useState<"recorded" | "local" | "worker">("recorded"),
    [newOpen, setNewOpen] = useState(false),
    [starting, setStarting] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [eventId, setEventId] = useState<string | null>(null),
    [notice, setNotice] = useState(""),
    [library, setLibrary] = useState<Run[]>([]),
    [draftScenario, setDraftScenario] = useState<Scenario>("scarcity"),
    [draftPolicy, setDraftPolicy] = useState<Policy>("baseline"),
    [draftSeed, setDraftSeed] = useState("42"),
    [queued, setQueued] = useState<Intervention>(),
    [workerAvailable, setWorkerAvailable] = useState(false),
    [workerRuns, setWorkerRuns] = useState<
      { id: string; name: string; tick: number; running: boolean }[]
    >([]);
  const sessionRef = useRef(0);
  const loadRef = useRef(0);
  const ref = useRef({ run, tick, mode, queued });
  useLayoutEffect(() => {
    ref.current = { run, tick, mode, queued };
  }, [run, tick, mode, queued]);
  const streamRef = useRef<EventSource | null>(null);
  const revisionRef = useRef(0);
  const last = run.snapshots.length - 1,
    w = run.snapshots[tick] || run.snapshots[last],
    m = metrics(run, tick);
  const incidentEvents = run.events.filter((e) => e.type === "claim");
  const visibleIncidents = run.incidents.filter((i) => i.tick <= tick);
  const activeEvent = run.events.find((e) => e.id === eventId);
  const latestClaim = visibleIncidents.at(-1);
  useEffect(() => {
    const hydrate = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE) || "[]");
        if (Array.isArray(saved))
          setLibrary(saved.filter(validateSaved).slice(0, 8));
      } catch {
        setNotice(
          "Saved runs could not be read. You can still start a new simulation.",
        );
      }
      const q = new URLSearchParams(location.search);
      if (q.has("seed")) {
        const c = {
          seed: Number(q.get("seed")),
          scenario: q.get("scenario") as Scenario,
          policy: q.get("policy") as Policy,
        };
        setRun(runToEnd(c));
        setTick(0);
      }
    }, 0);
    if (["localhost", "127.0.0.1"].includes(location.hostname))
      fetch("http://127.0.0.1:8787/health")
        .then((r) => r.ok && setWorkerAvailable(true))
        .catch(() => {});
    return () => {
      clearTimeout(hydrate);
      streamRef.current?.close();
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (!["localhost", "127.0.0.1"].includes(location.hostname)) return;
    if (view === "library" || newOpen)
      fetch("http://127.0.0.1:8787/runs")
        .then(async (r) => {
          if (r.ok) {
            setWorkerAvailable(true);
            const data = (await r.json()) as {
              runs: {
                id: string;
                name: string;
                tick: number;
                running: boolean;
              }[];
            };
            setWorkerRuns(data.runs);
          }
        })
        .catch(() => setWorkerAvailable(false));
  }, [view, newOpen]);
  function attachWorker(data: {
    run: Run;
    version: number;
    running?: boolean;
    queued?: Intervention;
  }) {
    const session = ++sessionRef.current;
    streamRef.current?.close();
    setQueued(data.queued);
    revisionRef.current = data.version;
    setRun(data.run);
    setMode("worker");
    setTick(data.run.snapshots.length - 1);
    setPlaying(!!data.running);
    const stream = new EventSource(
      `http://127.0.0.1:8787/runs/${data.run.id}/stream`,
    );
    streamRef.current = stream;
    stream.onmessage = (e) => {
      const update = JSON.parse(e.data);
      if (
        session === sessionRef.current &&
        update.run &&
        update.run.id === data.run.id &&
        update.version >= revisionRef.current
      ) {
        revisionRef.current = update.version;
        setRun(update.run);
        setTick(update.run.snapshots.length - 1);
        setPlaying(update.running);
        setQueued(update.queued);
      }
    };
    stream.onerror = () => {
      if (session === sessionRef.current)
        setNotice("Worker stream disconnected. Reconnecting automatically.");
    };
  }
  async function openWorker(id: string) {
    const session = sessionRef.current,
      request = ++loadRef.current;
    try {
      const res = await fetch(`http://127.0.0.1:8787/runs/${id}`);
      if (!res.ok) throw Error("Cannot load worker run");
      const data = (await res.json()) as {
        run: Run;
        version: number;
        running: boolean;
      };
      if (session !== sessionRef.current || request !== loadRef.current) return;
      attachWorker(data);
      setView("observatory");
    } catch (e) {
      if (session === sessionRef.current && request === loadRef.current)
        setNotice(e instanceof Error ? e.message : "Worker unavailable");
    }
  }
  const workerCommand = useCallback(
    async (action: string, intervention?: Intervention) => {
      const session = sessionRef.current;
      const runId = ref.current.run.id;
      try {
        const r = await fetch(`http://127.0.0.1:8787/runs/${runId}/commands`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: crypto.randomUUID(),
            expectedVersion: revisionRef.current,
            action,
            intervention,
          }),
        });
        const data = (await r.json()) as {
          run: Run;
          version: number;
          running: boolean;
          queued?: Intervention;
          error?: string;
        };
        if (!r.ok) throw Error(data.error || "Worker command failed");
        if (session !== sessionRef.current) return;
        if (data.version >= revisionRef.current) {
          revisionRef.current = data.version;
          setRun(data.run);
          setTick(data.run.snapshots.length - 1);
          setPlaying(data.running);
          setQueued(data.queued);
        }
      } catch (e) {
        if (session !== sessionRef.current) return;
        setNotice(e instanceof Error ? e.message : "Worker unavailable");
      }
    },
    [],
  );
  const step = useCallback(() => {
    const s = ref.current;
    if (s.mode === "worker") {
      void workerCommand("step");
      return;
    }
    if (s.tick < s.run.snapshots.length - 1) {
      setTick((t) => Math.min(t + 1, s.run.snapshots.length - 1));
      return;
    }
    if (s.mode === "local" && s.run.status === "active") {
      const next = advance(s.run, s.queued);
      setRun(next);
      setTick(next.snapshots.length - 1);
      setQueued(undefined);
    } else setPlaying(false);
  }, [workerCommand]);
  useEffect(() => {
    if (!playing || mode === "worker") return;
    const t = setInterval(step, 1000 / Number(speed));
    return () => clearInterval(t);
  }, [playing, speed, step, mode]);
  function openRun(r: Run) {
    sessionRef.current++;
    streamRef.current?.close();
    setRun(r);
    setTick(0);
    setMode("recorded");
    setPlaying(false);
    setQueued(undefined);
    setView("observatory");
    select("mira");
  }
  function save() {
    try {
      const next = [run, ...library.filter((r) => r.id !== run.id)].slice(0, 6);
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
    const seed = Number(draftSeed);
    if (!Number.isInteger(seed) || seed < 0 || seed > 999999) {
      setNotice("Choose a whole-number seed from 0 to 999999.");
      return;
    }
    const session = sessionRef.current,
      request = ++loadRef.current;
    setStarting(true);
    const config = {
      seed,
      scenario: draftScenario,
      policy: draftPolicy,
      maxTicks: 60,
    };
    try {
      if (useWorker) {
        const res = await fetch("http://127.0.0.1:8787/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
        const data = (await res.json()) as {
          run: Run;
          version: number;
          error?: string;
        };
        if (!res.ok) throw Error(data.error || "Cannot create worker run");
        if (session !== sessionRef.current || request !== loadRef.current)
          return;
        attachWorker(data);
      } else {
        sessionRef.current++;
        streamRef.current?.close();
        setPlaying(false);
        setRun({ ...createRun(config), id: `local-${crypto.randomUUID()}` });
        setMode("local");
      }
      setTick(0);
      setView("observatory");
      setNewOpen(false);
      setQueued(undefined);
      select("mira");
    } catch (e) {
      if (session === sessionRef.current && request === loadRef.current)
        setNotice(e instanceof Error ? e.message : "Worker unavailable");
    } finally {
      setStarting(false);
    }
  }
  function jump(t: number) {
    if (ref.current.mode === "worker") {
      setNotice("Save this worker run, then open its replay to rewind.");
      return;
    }
    setPlaying(false);
    setTick(Math.max(0, Math.min(t, last)));
  }
  function toggle() {
    if (mode === "worker") {
      void workerCommand(playing ? "pause" : "resume");
    } else setPlaying(!playing);
  }
  function intervene(action: Intervention) {
    if (mode === "worker") {
      void workerCommand("intervene", action);
    } else {
      setQueued(action);
      setNotice("Intervention queued for the next new tick.");
    }
  }
  const exposed = useRef({ jump, openRun, step });
  useLayoutEffect(() => {
    exposed.current = { jump, openRun, step };
  });
  useEffect(() => {
    type MC = {
      registerTool: (
        x: unknown,
        o: { signal: AbortSignal },
      ) => Promise<void> | void;
    };
    const mc = (document as unknown as { modelContext?: MC }).modelContext;
    if (!mc?.registerTool) return;
    const lifecycle = new AbortController();
    Promise.resolve(
      mc.registerTool(
        {
          name: "settlement_inspect_run",
          description: "Read the visible run status and incident metrics.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: () => {
            const s = ref.current;
            return {
              tick: s.tick,
              mode: s.mode,
              metrics: metrics(s.run, s.tick),
              config: s.run.config,
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    Promise.resolve(
      mc.registerTool(
        {
          name: "settlement_seek_tick",
          description:
            "Move recorded playback to an existing tick and pause playback.",
          inputSchema: {
            type: "object",
            properties: { tick: { type: "integer", minimum: 0, maximum: 150 } },
            required: ["tick"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: (input: unknown) => {
            const n = (input as { tick: number })?.tick;
            if (
              !Number.isInteger(n) ||
              n < 0 ||
              n >= ref.current.run.snapshots.length
            )
              throw Error("Tick is outside the recorded run");
            exposed.current.jump(n);
            return { tick: n };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, []);
  const wealth = useMemo(
    () =>
      w.agents
        .filter((a) => a.role === "resident")
        .map((a) => ({
          name: a.name,
          coins: a.inventory.coins,
          color: a.color,
        })),
    [w],
  );
  return (
    <main className="settlement">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Settlement home">
          <span className="brand-icon">
            <Sprout />
          </span>
          Settlement
        </Link>
        <nav aria-label="Main navigation">
          {[
            ["observatory", "Observatory"],
            ["experiments", "Experiments"],
            ["library", "Run library"],
          ].map(([id, name]) => (
            <button
              key={id}
              className={view === id ? "nav-active" : ""}
              onClick={() => {
                setView(id);
                setPlaying(false);
              }}
            >
              {name}
            </button>
          ))}
        </nav>
        <button className="about-button" onClick={() => setHelpOpen(true)}>
          Field guide <BookOpen size={15} />
        </button>
      </header>
      <div className="workspace-heading">
        <div>
          <p className="breadcrumb">
            Your field station <span>/</span>{" "}
            {view === "observatory"
              ? "Willowmere"
              : view === "experiments"
                ? "Experiments"
                : "Saved runs"}
          </p>
          <h1>
            {view === "observatory"
              ? "A small world. Consequential decisions."
              : view === "experiments"
                ? "Evidence over assumptions."
                : "Stories you can return to."}
          </h1>
        </div>
        <button className="primary" onClick={() => setNewOpen(true)}>
          <Plus size={17} /> New simulation
        </button>
      </div>
      {view === "observatory" && (
        <>
          <div className="scenario-strip">
            <div className="scenario-icon">
              <FlaskConical size={20} />
            </div>
            <div>
              <strong>{run.name}</strong>
              <span>{scenarioInfo[run.config.scenario].description}</span>
            </div>
            <span className="policy-label">
              {policyInfo[run.config.policy].name}
            </span>
            <button
              className="text-button"
              onClick={() => {
                const e =
                  incidentEvents.find((e) => e.tick > tick) ||
                  incidentEvents[0];
                if (e) {
                  jump(e.tick);
                  select(e.target || "rook");
                } else
                  setNotice(
                    "The first claim arrives at tick 8. Advance the simulation.",
                  );
              }}
            >
              Find an incident <ArrowUpRight size={15} />
            </button>
          </div>
          <section className="world-layout">
            <div className="map-panel">
              <div className="map-heading">
                <div>
                  <h2>Willowmere</h2>
                  <span>Early autumn · Day {Math.floor(tick / 20) + 1}</span>
                </div>
                <span className="mode-badge">
                  {mode === "recorded" ? (
                    <>
                      <Clock size={12} />
                      Recorded run
                    </>
                  ) : mode === "worker" ? (
                    <>
                      <Server size={12} />
                      Local worker
                    </>
                  ) : (
                    <>
                      <Radio size={12} />
                      Browser simulation
                    </>
                  )}
                </span>
              </div>
              <VillageMap
                residents={w.agents}
                selected={selected}
                onSelect={select}
              />
              <div className="map-footer">
                <span>
                  <Users size={15} />6 residents
                </span>
                <span>
                  <ShieldAlert size={15} />1 Chaos agent
                </span>
                <span>Seed {run.config.seed}</span>
              </div>
              <div className="resident-picker" aria-label="Residents">
                {w.agents.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => select(a.id)}
                    className={selected === a.id ? "selected" : ""}
                  >
                    <i style={{ background: a.color }} />
                    {a.name}
                  </button>
                ))}
              </div>
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
                  tick === last &&
                  run.status === "completed" &&
                  mode !== "recorded"
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
                  (tick === last && run.status === "completed") ||
                  (mode === "worker" && playing)
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
                  {playing
                    ? "Playing"
                    : tick === last && run.status === "completed"
                      ? "Completed"
                      : "Paused"}
                </span>
              </div>
              <Slider
                aria-label="Playback tick"
                min={0}
                max={Math.max(last, 1)}
                value={[tick]}
                onValueChange={(v) => jump(v[0])}
                disabled={last === 0 || mode === "worker"}
              />
              <div className="incident-markers">
                {incidentEvents.map((e) => (
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
            <Select value={speed} onValueChange={setSpeed}>
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
              Deterministic policies · {run.modelCalls} model calls · $0 API
              cost
            </span>
            <div>
              {mode !== "recorded" && run.status === "active" && (
                <Select
                  value=""
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
          <div className="lower-grid">
            <section className="activity-panel">
              <Tabs defaultValue="incidents">
                <div className="section-heading">
                  <TabsList variant="line">
                    <TabsTrigger value="incidents">
                      Incident log{" "}
                      <span className="count">{visibleIncidents.length}</span>
                    </TabsTrigger>
                    <TabsTrigger value="events">Event feed</TabsTrigger>
                    <TabsTrigger value="blackboard">Public board</TabsTrigger>
                  </TabsList>
                  <span className="muted-small">At tick {tick}</span>
                </div>
                <TabsContent value="incidents">
                  {visibleIncidents.length === 0 ? (
                    <div className="quiet-state">
                      <ShieldAlert size={25} />
                      <h3>A quiet morning. For now.</h3>
                      <p>
                        The first claim is scheduled for tick 8. Play the run or
                        jump to the incident.
                      </p>
                      <button
                        className="text-button"
                        onClick={() => {
                          if (last >= 8) jump(8);
                          else {
                            toggle();
                          }
                        }}
                      >
                        Watch what happens <ArrowUpRight size={15} />
                      </button>
                    </div>
                  ) : (
                    visibleIncidents
                      .slice()
                      .reverse()
                      .map((i) => {
                        const outcome =
                          i.resolvedTick !== null && i.resolvedTick <= tick
                            ? i.outcome
                            : "pending";
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
                                <strong>{scenarioInfo[i.family].name}</strong>
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
                    {run.events
                      .filter((e) => e.tick <= tick)
                      .slice(-20)
                      .reverse()
                      .map((e) => (
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
                    {run.events
                      .filter(
                        (e) =>
                          e.tick <= tick &&
                          (e.type === "claim" || e.type === "intervention"),
                      )
                      .map((e) => (
                        <button
                          className="board-note"
                          key={e.id}
                          onClick={() => setEventId(e.id)}
                        >
                          <span>
                            Tick {e.tick} · {e.actor}
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
                          width: `${(a.coins / Math.max(40, ...wealth.map((x) => x.coins))) * 100}%`,
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
          {workerAvailable && workerRuns.length > 0 && (
            <div className="worker-library">
              <h3>On your local worker</h3>
              <p className="muted-small">
                Stored in SQLite. Resume across page reloads and worker
                restarts.
              </p>
              {workerRuns.map((r) => (
                <article className="library-row" key={r.id}>
                  <div>
                    <h3>{r.name}</h3>
                    <p>
                      Tick {r.tick} · {r.running ? "Running" : "Paused"}
                    </p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => void openWorker(r.id)}
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
                    Seed {r.config.seed} · {policyInfo[r.config.policy].name} ·{" "}
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
            <p>{scenarioInfo[draftScenario].description}</p>
          </div>
          <div className="form-field">
            <label>Resident policy</label>
            <Select
              value={draftPolicy}
              onValueChange={(v) => setDraftPolicy(v as Policy)}
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
          {workerAvailable && (
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
            This release uses deterministic rules, not a language model. Results
            illustrate these scenarios; they do not establish general agent
            safety. Browser runs advance while this page is open. The optional
            local worker persists and advances independently.
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
    </main>
  );
}
function CoinsLegend() {
  return <span className="muted-small">coins</span>;
}
