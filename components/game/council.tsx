"use client";
import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Coins,
  Download,
  Eye,
  Flag,
  Leaf,
  Pause,
  Play,
  ScrollText,
  ShieldCheck,
  SkipForward,
  Users,
  Wheat,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  chapters,
  CHAPTER_TICKS,
  compareCouncil,
  councilPending,
  councilRun,
  newCouncil,
  residentView,
} from "@/lib/game/council";
import type {
  CouncilCommand,
  CouncilEntry,
  CouncilState,
} from "@/lib/game/council";
import { policyInfo } from "@/lib/sim/engine";
import type { Agent, Policy, Run } from "@/lib/sim/types";
import type { Game } from "@/lib/game/model";
import "./council.css";

function Face({ agent, small = false }: { agent: Agent; small?: boolean }) {
  return (
    <span
      className={`resident-face ${small ? "small" : ""}`}
      style={{ "--resident-color": agent.color } as React.CSSProperties}
    >
      {agent.name[0]}
    </span>
  );
}
function Change({ entry }: { entry: CouncilEntry }) {
  return (
    <span
      className={`civic-change ${entry.kind === "harm" || entry.kind === "order" ? "loss" : ""}`}
    >
      {Object.entries(entry.delta)
        .filter(([, n]) => n !== 0)
        .map(([r, n]) => (
          <span key={r}>
            {n > 0 ? "+" : "−"}
            {Math.abs(n)} {r === "wood" ? "timber" : r}
          </span>
        ))}
      {entry.uncovered > 0 && <span>{entry.uncovered} gold uncovered</span>}
    </span>
  );
}
export function VillageLife({
  game,
  onOpen,
}: {
  game: Game;
  onOpen: (resident?: string) => void;
}) {
  const c = game.council ?? newCouncil(),
    run = councilRun(c);
  const pending = councilPending(run)[0];
  const agents = run.snapshots.at(-1)!.agents;
  return (
    <aside
      className={`village-life ${pending ? "has-incident" : ""}`}
      aria-label="Village life"
    >
      <div className="life-eyebrow">
        <span>
          <Users size={14} /> Village life
        </span>
        <span>Chapter {c.chapter + 1}/4</span>
      </div>
      <button className="life-story" onClick={() => onOpen(pending?.target)}>
        <span className="life-icon">{pending ? <ScrollText /> : <Leaf />}</span>
        <span>
          <strong>
            {pending
              ? "A claim needs your attention"
              : chapters[c.chapter].title}
          </strong>
          <small>
            {pending
              ? `Rook is speaking to ${agents.find((a) => a.id === pending.target)?.name}. Investigate the claim.`
              : c.tick === CHAPTER_TICKS
                ? "Chapter complete. See how your village fared."
                : "Meet the people who make this village home."}
          </small>
        </span>
        <ChevronRight size={18} />
      </button>
      <div className="life-roster">
        {agents.map((a) => (
          <button
            key={a.id}
            aria-label={`Meet ${a.name}`}
            onClick={() => onOpen(a.id)}
          >
            <Face agent={a} small />
          </button>
        ))}
      </div>
      <button className="life-open" onClick={() => onOpen(pending?.target)}>
        <span className={`life-dot ${c.playing ? "active" : ""}`} />
        {c.playing
          ? "Village day in progress"
          : pending
            ? "Paused for your investigation"
            : c.tick
              ? "Open village council"
              : "Welcome your residents"}
        <ChevronRight size={15} />
      </button>
    </aside>
  );
}
function exportStory(c: CouncilState, run: Run) {
  const url = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          {
            kind: "settlement-council-evidence",
            version: 1,
            run,
            ledger: c.ledger.filter((e) => e.chapter === c.chapter),
            treasuryRule:
              "Work dividends are gameplay production; harm costs 20 village gold per scenario harm unit. Personal inventories are separate.",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `Settlement-chapter-${c.chapter + 1}-evidence.json`;
  a.click();
  URL.revokeObjectURL(url);
}
export function CouncilPanel({
  game,
  resident,
  onResident,
  onAction,
  onClose,
}: {
  game: Game;
  resident: string;
  onResident: (id: string) => void;
  onAction: (c: CouncilCommand) => void;
  onClose: () => void;
}) {
  const live = game.council ?? newCouncil();
  const [cursor, setCursor] = useState<number | null>(null),
    [archive, setArchive] = useState<number | null>(null),
    [tab, setTab] = useState<"story" | "compare" | "ledger">("story"),
    [evidence, setEvidence] = useState<string | null>(null);
  const historical = archive !== null && archive !== live.chapter;
  const past = historical
    ? live.history.find((h) => h.chapter === archive)
    : undefined;
  const base = past
    ? { ...live, ...past, tick: CHAPTER_TICKS, playing: false }
    : live;
  const at = Math.min(cursor ?? base.tick, base.tick);
  const view = {
    ...base,
    tick: at,
    interventions: base.interventions.filter((i) => i.tick <= at),
  };
  const run = councilRun(view),
    world = run.snapshots.at(-1)!;
  const reading = historical || at !== live.tick;
  const person = residentView(run, resident, at);
  const incident =
    councilPending(run).find((i) => i.target === resident) ??
    run.incidents.at(-1);
  const visibleEvidence =
    person.decision?.evidenceIds
      .map((id) => person.events.find((e) => e.id === id))
      .filter((e): e is NonNullable<typeof e> => !!e) ?? [];
  const highlighted = evidence
    ? run.events.find(
        (e) =>
          e.id === evidence &&
          (e.visibility === "public" || e.audience.includes(resident)),
      )
    : undefined;
  const comparison = useMemo(
    () => compareCouncil({ ...newCouncil(), chapter: base.chapter }),
    [base.chapter],
  );
  const currentLedger = live.ledger.filter(
    (e) => e.chapter === base.chapter && e.tick <= at,
  );
  const totals = currentLedger.reduce(
    (r, e) => ({
      gold: r.gold + e.delta.gold,
      food: r.food + e.delta.food,
      wood: r.wood + e.delta.wood,
    }),
    { gold: 0, food: 0, wood: 0 },
  );
  const done = live.tick === CHAPTER_TICKS;
  const command = (c: CouncilCommand) => {
    setCursor(null);
    setEvidence(null);
    onAction(c);
  };
  function selectPerson(id: string) {
    onResident(id);
    setEvidence(null);
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="council-dialog"
        aria-describedby="council-description"
      >
        <header className="council-heading">
          <div className="council-seal">
            <Users size={27} />
          </div>
          <div>
            <span className="council-eyebrow">
              The people of Willowmere · Chapter {base.chapter + 1}
            </span>
            <DialogTitle>Village council</DialogTitle>
            <DialogDescription id="council-description">
              A living village. A story you can investigate. Decisions that
              matter to your home.
            </DialogDescription>
          </div>
        </header>
        <div className="council-topbar">
          <nav aria-label="Council sections">
            {(["story", "ledger", "compare"] as const).map((t) => (
              <button
                key={t}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {t === "story" ? (
                  <BookOpen size={16} />
                ) : t === "ledger" ? (
                  <Coins size={16} />
                ) : (
                  <ShieldCheck size={16} />
                )}
                {t === "story"
                  ? "Village story"
                  : t === "ledger"
                    ? "Treasury trail"
                    : "Compare policies"}
              </button>
            ))}
          </nav>
          <span className="council-status">
            {historical || cursor !== null
              ? "Recorded history"
              : live.playing
                ? "Live · rule-based"
                : done
                  ? "Chapter complete"
                  : "Paused · rule-based"}
          </span>
        </div>
        <div className="council-scroll">
          <div className="chapter-banner">
            <span className="chapter-number">0{base.chapter + 1}</span>
            <div>
              <h2>{chapters[base.chapter].title}</h2>
              <p>{chapters[base.chapter].subtitle}</p>
            </div>
            <span className="chapter-tick">
              Tick <b>{at}</b> / {CHAPTER_TICKS}
            </span>
          </div>
          {live.history.length > 0 && (
            <label className="council-archive">
              Story archive{" "}
              <select
                aria-label="View a council chapter"
                value={archive ?? live.chapter}
                onChange={(e) => {
                  if (live.playing) onAction({ type: "pause" });
                  setArchive(Number(e.target.value));
                  setCursor(null);
                  setEvidence(null);
                }}
              >
                {[...live.history.map((h) => h.chapter), live.chapter].map(
                  (i) => (
                    <option key={i} value={i}>
                      {i + 1}. {chapters[i].title}
                      {i === live.chapter ? " · current" : " · recorded"}
                    </option>
                  ),
                )}
              </select>
            </label>
          )}
          {tab === "story" && (
            <>
              {incident ? (
                <section
                  className={`council-incident ${incident.outcome !== "pending" ? "resolved" : ""}`}
                  aria-label="Current incident"
                >
                  <div className="incident-caption">
                    <ScrollText size={18} />
                    <b>
                      {incident.outcome === "pending"
                        ? "A claim at the market"
                        : "An incident on record"}
                    </b>
                    <span>Tick {incident.tick}</span>
                  </div>
                  <blockquote>“{incident.claim}”</blockquote>
                  <div className="claim-route">
                    <span>
                      Rook <ChevronRight size={13} />{" "}
                      <button onClick={() => selectPerson(incident.target)}>
                        {
                          world.agents.find((a) => a.id === incident.target)
                            ?.name
                        }
                      </button>
                    </span>
                    <span>
                      {incident.outcome === "pending"
                        ? incident.decision === "checking"
                          ? "Checking evidence"
                          : incident.decision === "accepted"
                            ? "Offer accepted · observing outcome"
                            : incident.decision === "refused"
                              ? "Offer refused · observing outcome"
                              : incident.decision === "failed"
                                ? "Trade could not complete"
                                : "Waiting for a decision"
                        : incident.outcome === "succeeded"
                          ? "Harm occurred"
                          : incident.outcome === "resisted"
                            ? "Defined harm avoided"
                            : incident.outcome === "benign"
                              ? "Honest offer"
                              : "Unresolved"}
                    </span>
                  </div>
                  <p className="incident-footnote">
                    {incident.outcome === "pending"
                      ? "A claim is not a fact. Inspect what its recipient knows, publish evidence, or let their policy decide."
                      : `Recorded harm: ${incident.harm} scenario units. ${incident.detectedTick !== null ? `Detected at tick ${incident.detectedTick}.` : "No detection recorded."} Select a past tick to inspect the decision as it happened.`}
                  </p>
                </section>
              ) : (
                <section className="council-welcome">
                  <Leaf size={25} />
                  <div>
                    <h3>Every village has a story.</h3>
                    <p>
                      Six residents work, eat and trade here. Rook arrives with
                      a claim at tick 8. Their work adds village supplies; bad
                      trades can cost your treasury. Start the day, then follow
                      the evidence.
                    </p>
                  </div>
                </section>
              )}
              <div className="council-people">
                <aside className="resident-roster">
                  <h3>Your residents</h3>
                  {world.agents.map((a) => (
                    <button
                      className={a.id === resident ? "selected" : ""}
                      key={a.id}
                      aria-pressed={a.id === resident}
                      onClick={() => selectPerson(a.id)}
                    >
                      <Face agent={a} />
                      <span>
                        <strong>{a.name}</strong>
                        <small>{a.occupation}</small>
                      </span>
                      <ChevronRight size={14} />
                    </button>
                  ))}
                </aside>
                <section
                  className="resident-details"
                  aria-label={`${person.agent.name}'s perspective at tick ${at}`}
                >
                  <div className="resident-detail-heading">
                    <div>
                      <span className="council-eyebrow">
                        {person.agent.location} · perspective at tick {at}
                      </span>
                      <h3>{person.agent.name}’s next move</h3>
                    </div>
                    <Face agent={person.agent} />
                  </div>
                  <div className="resident-needs">
                    <span>
                      Hunger <b>{person.agent.hunger}/100</b>
                    </span>
                    <span>
                      Trust tendency{" "}
                      <b>{Math.round(person.agent.trust * 100)}%</b>
                    </span>
                    <span>
                      Personal grain <b>{person.agent.inventory.grain}</b>
                    </span>
                  </div>
                  <div className="resident-goal">
                    <span>Selected goal</span>
                    <h4>{person.agent.goal}</h4>
                    <p>
                      {person.decision?.summary ??
                        (person.agent.role === "chaos"
                          ? "Rook delivers authored scenario claims at scheduled opportunities. No paid AI is running."
                          : "The day has not started. Advance one tick to see this resident choose an action.")}
                    </p>
                  </div>
                  {person.decision && (
                    <div className="resident-decision">
                      <span>Action · tick {person.decision.tick}</span>
                      <strong>{person.decision.selected}</strong>
                      <p>{person.decision.outcome}</p>
                      {person.decision.plan.length > 0 && (
                        <ol>
                          {person.decision.plan.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                  <div className="resident-evidence">
                    <h4>
                      <Eye size={16} /> Evidence used in this decision
                    </h4>
                    {visibleEvidence.length ? (
                      visibleEvidence.map((e) => (
                        <button key={e.id} onClick={() => setEvidence(e.id)}>
                          <span>Tick {e.tick}</span>
                          {e.title}
                          <ChevronRight size={14} />
                        </button>
                      ))
                    ) : (
                      <p>
                        No recorded source events used. The resident can still
                        act on their needs and local observations.
                      </p>
                    )}
                    {highlighted && (
                      <article className="evidence-detail">
                        <b>{highlighted.title}</b>
                        <p>{highlighted.detail}</p>
                        <small>
                          {highlighted.visibility === "public"
                            ? "Public evidence"
                            : `Visible to ${person.agent.name}`}{" "}
                          · tick {highlighted.tick} · source {highlighted.id}
                        </small>
                      </article>
                    )}
                  </div>
                  <details className="resident-memory">
                    <summary>
                      What {person.agent.name} remembers (
                      {person.memories.length})
                    </summary>
                    {person.memories
                      .slice(-8)
                      .reverse()
                      .map((m) => (
                        <article key={m.id}>
                          <span>
                            Tick {m.tick} · {m.type}
                          </span>
                          <p>{m.text}</p>
                          <small>Source {m.source}</small>
                        </article>
                      ))}
                    {!person.memories.length && (
                      <p>No memories recorded at this tick.</p>
                    )}
                  </details>
                </section>
              </div>
              <section className="council-orders">
                <div>
                  <span className="council-eyebrow">
                    Your role as village chief
                  </span>
                  <h3>Give them something to act on.</h3>
                  <p>
                    Each order costs village resources and advances one tick. It
                    does not guarantee that every resident will avoid harm.
                  </p>
                </div>
                <div className="council-order-buttons">
                  <button
                    disabled={
                      reading ||
                      done ||
                      world.verifiedStock ||
                      game.resources.gold < 20
                    }
                    onClick={() =>
                      command({ type: "intervene", action: "publish-stock" })
                    }
                  >
                    <ScrollText size={18} />
                    <span>
                      {world.verifiedStock
                        ? "Stock ledger published"
                        : "Publish verified stock"}
                      <small>20 gold · visible to everyone</small>
                    </span>
                  </button>
                  <button
                    disabled={reading || done || game.resources.food < 60}
                    onClick={() =>
                      command({ type: "intervene", action: "add-grain" })
                    }
                  >
                    <Wheat size={18} />
                    <span>
                      Deliver grain<small>60 food → 12 communal grain</small>
                    </span>
                  </button>
                </div>
              </section>
            </>
          )}
          {tab === "ledger" && (
            <section className="council-ledger">
              <div className="ledger-summary">
                <div>
                  <span>Chapter gold</span>
                  <strong>
                    {totals.gold >= 0 ? "+" : ""}
                    {totals.gold}
                  </strong>
                </div>
                <div>
                  <span>Chapter timber</span>
                  <strong>+{totals.wood}</strong>
                </div>
                <div>
                  <span>Chapter food</span>
                  <strong>
                    {totals.food >= 0 ? "+" : ""}
                    {totals.food}
                  </strong>
                </div>
              </div>
              <p className="council-explainer">
                These changes are already in your village treasury. Gathering
                earns work dividends; ready, upgraded farms and lumbermills
                improve them. Personal resident inventories remain separate.
                Deception costs 20 village gold per harm unit; reputation
                penalties represent lost trade opportunity.
              </p>
              {currentLedger.length ? (
                <ol className="ledger-entries">
                  {currentLedger
                    .slice()
                    .reverse()
                    .map((e) => (
                      <li key={e.id}>
                        <span className={`ledger-symbol ${e.kind}`}>
                          {e.kind === "harm" ? (
                            <Flag size={17} />
                          ) : e.kind === "order" ? (
                            <ScrollText size={17} />
                          ) : (
                            <Leaf size={17} />
                          )}
                        </span>
                        <div>
                          <strong>{e.label}</strong>
                          <button
                            onClick={() => {
                              setCursor(e.tick);
                              selectPerson(
                                e.actor === "observer" ? resident : e.actor,
                              );
                              setEvidence(e.kind === "harm" ? null : e.source);
                              setTab("story");
                            }}
                          >
                            Inspect tick {e.tick} · {e.source}{" "}
                            <ChevronRight size={12} />
                          </button>
                        </div>
                        <Change entry={e} />
                      </li>
                    ))}
                </ol>
              ) : (
                <div className="council-empty">
                  No treasury changes yet. Let the residents begin their day.
                </div>
              )}
            </section>
          )}
          {tab === "compare" && (
            <section className="council-comparison">
              <div className="compare-intro">
                <ShieldCheck size={28} />
                <div>
                  <h3>What would another policy do?</h3>
                  <p>
                    Three fresh runs of this chapter use the same seed and
                    starting conditions, with no chief’s orders. This comparison
                    does not spend or award village resources.
                  </p>
                </div>
              </div>
              <div className="policy-results">
                {comparison.map((result) => (
                  <article
                    key={result.policy}
                    className={result.policy === base.policy ? "chosen" : ""}
                  >
                    <span className="policy-label">
                      {result.policy === base.policy
                        ? "Your chapter policy"
                        : "Alternative policy"}
                    </span>
                    <h4>{policyInfo[result.policy].name}</h4>
                    <p>{policyInfo[result.policy].description}</p>
                    <dl>
                      <div>
                        <dt>Scenario harm</dt>
                        <dd>{result.metrics.harm}</dd>
                      </div>
                      <div>
                        <dt>Attacks evaluated</dt>
                        <dd>
                          {result.metrics.evaluable} / {result.metrics.attacks}
                        </dd>
                      </div>
                      <div>
                        <dt>Deceptions detected</dt>
                        <dd>{result.metrics.detections}</dd>
                      </div>
                      <div>
                        <dt>Unresolved cases</dt>
                        <dd>{result.metrics.unresolved}</dd>
                      </div>
                      <div>
                        <dt>Honest offers refused</dt>
                        <dd>
                          {result.metrics.benignRefused} /{" "}
                          {result.metrics.benignOffers}
                        </dd>
                      </div>
                      <div>
                        <dt>Evidence inspections</dt>
                        <dd>{result.inspections}</dd>
                      </div>
                      <div>
                        <dt>Model calls / spend</dt>
                        <dd>0 / $0</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
              <p className="council-explainer">
                Results apply to these authored, rule-based scenarios.
                Inspection takes actions and time. The evidence policy is
                designed for these inspectable cases; this is not a general AI
                safety benchmark.
              </p>
            </section>
          )}
          {!historical && live.tick === 0 && (
            <section className="council-policy">
              <label htmlFor="council-policy">
                How should residents approach social claims?
              </label>
              <select
                id="council-policy"
                value={live.policy}
                onChange={(e) =>
                  command({ type: "policy", policy: e.target.value as Policy })
                }
              >
                {Object.entries(policyInfo).map(([key, p]) => (
                  <option key={key} value={key}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p>
                {policyInfo[live.policy].description} This choice is fixed once
                the chapter starts.
              </p>
            </section>
          )}
          {!historical && done && (
            <div className="chapter-complete">
              <Flag size={25} />
              <div>
                <h3>
                  {live.chapter === 3
                    ? "Four stories. One village that keeps growing."
                    : "The day’s decisions are on record."}
                </h3>
                <p>
                  {live.chapter === 3
                    ? "Your evidence stays in the archive. Keep building and exploring; completed stories cannot be farmed for rewards."
                    : "The next chapter begins a fresh authored scenario. Your village, army and treasury carry forward."}
                </p>
              </div>
              {live.chapter < 3 && (
                <button
                  className="council-primary"
                  onClick={() => command({ type: "next" })}
                >
                  Next chapter <ChevronRight size={17} />
                </button>
              )}
            </div>
          )}
        </div>
        <footer className="council-footer">
          <div className="council-timeline">
            <label htmlFor="council-timeline">
              {reading ? "Recorded" : "Current"} tick {at}
            </label>
            <input
              id="council-timeline"
              type="range"
              min="0"
              max={Math.max(1, base.tick)}
              value={at}
              disabled={base.tick === 0}
              onChange={(e) => {
                if (live.playing) onAction({ type: "pause" });
                setCursor(Number(e.target.value));
                setEvidence(null);
              }}
            />
            <button
              disabled={!reading && cursor === null}
              onClick={() => {
                setArchive(null);
                setCursor(null);
                setEvidence(null);
              }}
            >
              Return to current
            </button>
          </div>
          <div className="council-controls">
            <span>
              {historical
                ? "Archive · replay only"
                : done
                  ? "All decisions recorded"
                  : "Pauses at every new claim"}
            </span>
            <button
              className="council-export"
              onClick={() => exportStory(base, councilRun(base))}
              aria-label="Export chapter evidence"
            >
              <Download size={17} />
              <span>Export evidence</span>
            </button>
            <button
              disabled={reading || done}
              onClick={() => command({ type: "step" })}
            >
              <SkipForward size={17} /> One tick
            </button>
            <button
              className="council-primary"
              disabled={reading || done}
              onClick={() => command({ type: live.playing ? "pause" : "play" })}
            >
              {live.playing ? <Pause size={17} /> : <Play size={17} />}
              {live.playing
                ? "Pause day"
                : live.tick
                  ? "Continue day"
                  : "Start village day"}
            </button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
