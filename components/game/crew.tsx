"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  Hammer,
  Sprout,
  BookOpen,
  Check,
  ChevronRight,
  ChevronDown,
  Coins,
  Flag,
  Footprints,
  Handshake,
  Pause,
  Play,
  Shield,
  Sparkles,
  Users,
  Wheat,
  TreePine,
  Coffee,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Game } from "@/lib/game/model";
import type { CrewCommand } from "@/lib/game/crew-types";
import {
  crewRoster,
  crewPreview,
  crewProgress,
  newCrew,
} from "@/lib/game/crew";
import { ResidentAvatar } from "./resident-avatar";
import {
  DevelopmentBudget,
  DevelopmentDialog,
  DevelopmentSteps,
  ResourceAmounts as Amounts,
} from "./development-panel";
import "./crew.css";
const icons = { gold: Coins, wood: TreePine, food: Wheat };
const resourceName = { gold: "gold", wood: "timber", food: "food" };
const title = {
  raid: "Prepare for a raid",
  stockpile: "Restock the village",
  develop: "Grow the village",
};
const phoneQuery = "(max-width: 700px)";
function subscribePhone(callback: () => void) {
  const query = window.matchMedia(phoneQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
function phoneSnapshot() {
  return window.matchMedia(phoneQuery).matches;
}
function serverPhoneSnapshot() {
  return false;
}

export function CrewBoard({
  game,
  onCommand,
  onInspect,
  onCouncil,
  onRaid,
}: {
  game: Game;
  onCommand: (c: CrewCommand) => void;
  onInspect: (id?: string) => void;
  onCouncil: () => void;
  onRaid: () => void;
}) {
  const phone = useSyncExternalStore(
    subscribePhone,
    phoneSnapshot,
    serverPhoneSnapshot,
  );
  const [requestedExpanded, setExpanded] = useState<boolean | null>(null);
  const [reviewGrowth, setReviewGrowth] = useState(false);
  const headingRef = useRef<HTMLButtonElement>(null);
  const expanded = requestedExpanded ?? !phone;
  const crew = game.crew ?? newCrew(game),
    objective = crew.objective,
    latestEvent = crew.events.at(-1),
    preview = crewPreview(game, "raid"),
    progress = crewProgress(game);
  const state =
    crew.status === "complete"
      ? "Complete"
      : crew.playing
        ? "Working"
        : "Paused";
  const percent = crew.status === "complete" ? 100 : progress.percent;
  const development = progress.development;
  const nextStep =
    development?.steps.find((step) => step.status === "building") ??
    development?.steps.find((step) => step.status === "ready") ??
    development?.steps.find((step) => step.status === "blocked");
  return (
    <>
      <aside
        className="crew-board"
        aria-label="Village orders"
        data-expanded={expanded}
        data-mode={requestedExpanded === null ? "auto" : "manual"}
      >
        <button
          className="crew-board-heading"
          ref={headingRef}
          aria-label={
            expanded ? "Collapse village orders" : "Expand village orders"
          }
          aria-expanded={expanded}
          aria-controls="village-order-details"
          onClick={() => setExpanded(!expanded)}
        >
          <span>
            <Flag size={15} aria-hidden="true" /> Village orders
          </span>
          <span className="crew-heading-count">
            6 residents{" "}
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        </button>
        <button
          className="crew-collapsed-summary"
          onClick={() => setExpanded(true)}
          tabIndex={expanded ? -1 : 0}
        >
          <span className="crew-summary-title">
            {objective ? title[objective.kind] : "What shall we build next?"}
          </span>
          <span>
            {objective
              ? `${percent}% · ${state}`
              : "Give your residents an objective"}
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <div className="crew-board-body" id="village-order-details">
          {!objective ? (
            <>
              <h2>
                A village with
                <br />a purpose.
              </h2>
              <p>Choose the goal. Your residents find the way.</p>
              <button
                className="crew-start"
                onClick={() => setReviewGrowth(true)}
              >
                <Sprout size={24} aria-hidden="true" />
                <span>
                  <b>Grow the village</b>
                  <small>Review a new farm and upgrade plan</small>
                </span>
                <ArrowRight size={17} aria-hidden="true" />
              </button>
              <button
                className="crew-secondary-objective"
                onClick={() => onCommand({ type: "start", kind: "raid" })}
              >
                <Shield size={18} aria-hidden="true" />
                <span>
                  <b>Prepare for a raid</b>
                  <small>30 ready troops and village reserves</small>
                </span>
                <ChevronRight size={15} aria-hidden="true" />
              </button>
              <p className="crew-budget">
                Recruitment ceiling <Amounts value={preview.budget} />
              </p>
              <button
                className="crew-secondary-objective"
                onClick={() => onCommand({ type: "start", kind: "stockpile" })}
              >
                <Wheat size={18} aria-hidden="true" />
                <span>
                  <b>Restock the village</b>
                  <small>Collect 300 more of each resource</small>
                </span>
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <div className="crew-objective-title">
                {objective.kind === "develop" ? (
                  <Sprout size={21} />
                ) : (
                  <Flag size={20} />
                )}
                <div>
                  <h2>{title[objective.kind]}</h2>
                  <span>
                    {crew.status === "complete"
                      ? "The village is ready for more"
                      : crew.playing
                        ? "Your residents are coordinating"
                        : "Crew paused"}
                  </span>
                </div>
              </div>
              <div className="crew-progress-label">
                <span>
                  {crew.status === "complete"
                    ? "Objective complete"
                    : development
                      ? `${development.completed} / ${development.total} steps + reserves`
                      : objective.kind === "raid"
                        ? `${progress.readyTroops} / ${progress.targetTroops} troops ready`
                        : "Village reserves"}
                </span>
                <b>{percent}%</b>
              </div>
              <div
                className="crew-progress"
                role="progressbar"
                aria-label="Objective progress"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <i style={{ width: `${percent}%` }} />
              </div>
              {nextStep && crew.status !== "complete" && (
                <button className="crew-next-step" onClick={() => onInspect()}>
                  <Hammer size={16} aria-hidden="true" />
                  <span>
                    <b>{nextStep.label}</b>
                    <small>
                      {nextStep.reason ??
                        (nextStep.status === "building"
                          ? "Construction in progress"
                          : "Ready for the crew")}
                    </small>
                  </span>
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              )}
            </>
          )}
          <div className="crew-roster-label">
            <Users size={13} aria-hidden="true" />
            <span>
              {objective ? "Your village crew" : "Six residents, ready to help"}
            </span>
          </div>
          <div className="crew-mini-roster">
            {crewRoster.map((resident) => {
              const agent = crew.agents.find((a) => a.id === resident.id)!;
              return (
                <button
                  key={resident.id}
                  onClick={() => onInspect(resident.id)}
                  aria-label={`Inspect ${resident.name}'s work`}
                  title={`${resident.name}: ${agent.reason}`}
                >
                  <ResidentAvatar id={resident.id} size={38} />
                  <i
                    className={`crew-dot ${agent.status}`}
                    aria-hidden="true"
                  />
                  <small>{resident.name}</small>
                </button>
              );
            })}
          </div>
          {objective && (
            <>
              <p className="crew-live-note">
                {crew.status === "complete"
                  ? "The work is finished. Choose your next village objective."
                  : latestEvent
                    ? `${crewRoster.find((r) => r.id === latestEvent.actor)?.name ?? "Village"}: ${latestEvent.text}`
                    : "Residents are choosing their first jobs."}
              </p>
              <div className="crew-board-actions">
                {crew.status !== "complete" ? (
                  <button
                    onClick={() =>
                      onCommand({ type: crew.playing ? "pause" : "resume" })
                    }
                  >
                    {crew.playing ? <Pause size={14} /> : <Play size={14} />}
                    {crew.playing ? "Pause crew" : "Resume crew"}
                  </button>
                ) : objective.kind === "raid" ? (
                  <button onClick={onRaid}>
                    <Shield size={14} />
                    Scout a raid
                  </button>
                ) : (
                  <button onClick={() => onCommand({ type: "cancel" })}>
                    <Sprout size={14} />
                    Next objective
                  </button>
                )}
                <button onClick={() => onInspect()}>
                  View plan <ArrowRight size={14} />
                </button>
              </div>
              {crew.status === "complete" && objective.kind === "raid" && (
                <button
                  className="crew-new-objective"
                  onClick={() => onCommand({ type: "cancel" })}
                >
                  Choose another objective
                </button>
              )}
            </>
          )}
          <button className="crew-council-link" onClick={onCouncil}>
            <BookOpen size={13} />
            Council stories
            <ChevronRight size={13} />
          </button>
        </div>
      </aside>
      {reviewGrowth && (
        <DevelopmentDialog
          game={game}
          onClose={() => setReviewGrowth(false)}
          onReturnFocus={() => headingRef.current?.focus()}
          onStart={() => {
            onCommand({ type: "start", kind: "develop" });
            setReviewGrowth(false);
          }}
        />
      )}
    </>
  );
}
export function CrewInspector({
  game,
  selected,
  onSelected,
  onCommand,
  onClose,
  initialView = "agent",
  onReturnFocus,
}: {
  game: Game;
  selected: string;
  initialView?: "agent" | "jobs" | "history";
  onReturnFocus?: () => void;
  onSelected: (id: string) => void;
  onCommand: (c: CrewCommand) => void;
  onClose: () => void;
}) {
  const c = game.crew ?? newCrew(game),
    person = crewRoster.find((a) => a.id === selected) ?? crewRoster[0],
    agent = c.agents.find((a) => a.id === person.id)!;
  const [view, setView] = useState<"agent" | "jobs" | "history">(initialView);
  const objective = c.objective,
    progress = crewProgress(game),
    task = c.tasks.find((t) => t.id === agent.task);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="crew-dialog"
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          if (onReturnFocus) {
            event.preventDefault();
            onReturnFocus();
          }
        }}
      >
        <header className="crew-dialog-heading">
          <div>
            <span>
              <Handshake size={16} /> The village crew
            </span>
            <DialogTitle>The people of Willowmere</DialogTitle>
            <DialogDescription>
              Your residents claim jobs, coordinate resources, and change plans
              as the village changes.
            </DialogDescription>
          </div>
          <button onClick={onClose} aria-label="Close crew inspector">
            <X size={20} />
          </button>
        </header>
        <div className="crew-objective-strip">
          <Flag size={19} />
          <div>
            <strong>
              {objective
                ? title[objective.kind]
                : "Waiting for your first objective"}
            </strong>
            <span>
              {objective
                ? `${c.status === "complete" ? 100 : progress.percent}% complete · ${c.status === "complete" ? "Finished" : c.playing ? "Live coordination" : "Paused"}`
                : "Choose an objective from Village orders."}
            </span>
          </div>
          {objective && c.status === "active" && (
            <button
              onClick={() =>
                onCommand({ type: c.playing ? "pause" : "resume" })
              }
            >
              {c.playing ? <Pause size={15} /> : <Play size={15} />}{" "}
              {c.playing ? "Pause" : "Resume"}
            </button>
          )}
        </div>
        <div className="crew-inspector-layout">
          <aside className="crew-people" aria-label="Village crew residents">
            {crewRoster.map((r) => {
              const a = c.agents.find((a) => a.id === r.id)!;
              return (
                <button
                  key={r.id}
                  aria-pressed={person.id === r.id}
                  onClick={() => {
                    onSelected(r.id);
                    setView("agent");
                  }}
                >
                  <ResidentAvatar id={r.id} size={42} className="crew-avatar" />
                  <span>
                    <b>{r.name}</b>
                    <small>{r.role}</small>
                  </span>
                  <i className={`crew-dot ${a.status}`} />
                </button>
              );
            })}
          </aside>
          <section className="crew-detail">
            <nav aria-label="Crew inspection tools">
              {(
                [
                  ["agent", "Resident"],
                  ["jobs", "Village plan"],
                  ["history", "Village log"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={view === id}
                  onClick={() => setView(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
            {view === "agent" ? (
              <>
                <div className="crew-person-heading">
                  <ResidentAvatar
                    id={person.id}
                    size={76}
                    className="crew-avatar large"
                  />
                  <div>
                    <h3>{person.name}</h3>
                    <p>
                      {person.role} · {person.specialty}
                    </p>
                  </div>
                  <span className={`crew-status-pill ${agent.status}`}>
                    {c.status === "active" &&
                    !c.playing &&
                    agent.status !== "resting"
                      ? "paused"
                      : agent.status}
                  </span>
                </div>
                <div className="crew-reason">
                  <span>Current decision</span>
                  <h4>
                    {task?.label ??
                      (agent.status === "resting"
                        ? "Take a short rest"
                        : c.status === "complete"
                          ? "Ready for the next objective"
                          : "Watch for useful work")}
                  </h4>
                  <p>{agent.reason}</p>
                </div>
                {agent.plan.length > 0 && (
                  <ol className="crew-plan">
                    {agent.plan.map((step, i) => (
                      <li key={`${i}-${step}`}>
                        <span>{i + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                )}
                <div className="crew-person-stats">
                  <span>
                    <b>{agent.completed}</b>jobs completed
                  </span>
                  <span>
                    <b>{agent.experience}</b>practice points
                  </span>
                  <span>
                    <b>
                      {agent.x}, {agent.y}
                    </b>
                    village tile
                  </span>
                </div>
                <button
                  className="crew-rest"
                  disabled={
                    !objective ||
                    c.status !== "active" ||
                    !c.playing ||
                    agent.status === "resting"
                  }
                  onClick={() => onCommand({ type: "rest", id: agent.id })}
                >
                  <Coffee size={16} />{" "}
                  {agent.status === "resting"
                    ? `Resting · ${Math.max(0, agent.restUntil - c.tick)} ticks left`
                    : `Give ${person.name} a 20-tick rest`}
                </button>
                <p className="crew-help">
                  A resting resident releases their job so another available
                  resident can take over.
                </p>
                <div className="crew-memories">
                  <h4>What {person.name} remembers</h4>
                  {agent.memories.length ? (
                    agent.memories
                      .slice()
                      .reverse()
                      .map((m, i) => (
                        <p key={`${m.tick}-${i}`}>
                          <span>Tick {m.tick}</span>
                          {m.text}
                        </p>
                      ))
                  ) : (
                    <p className="crew-empty">
                      Memories appear as this resident claims work and completes
                      tasks.
                    </p>
                  )}
                </div>
              </>
            ) : view === "jobs" ? (
              <>
                <div className="crew-job-intro">
                  <h3>
                    {objective?.kind === "develop"
                      ? "From a plan to a living village."
                      : "A shared plan. Everyone has a part."}
                  </h3>
                  <p>
                    Residents choose useful work by role, distance and demand.
                    Each job has one owner.
                  </p>
                </div>
                {objective?.development && (
                  <>
                    <DevelopmentBudget
                      budget={objective.budget}
                      spent={objective.spent}
                      reserves={objective.development.reserveFloor}
                    />
                    <DevelopmentSteps
                      game={game}
                      plan={objective.development}
                    />
                  </>
                )}
                {objective && (
                  <>
                    <h4 className="crew-reserves-heading">Village reserves</h4>
                    <div className="crew-reserve-grid">
                      {progress.resources.map((r) => {
                        const Icon = icons[r.resource];
                        return (
                          <div key={r.resource}>
                            <Icon size={17} />
                            <b>
                              {Math.floor(r.current)}{" "}
                              <small>/ {Math.ceil(r.target)}</small>
                            </b>
                            <span>{resourceName[r.resource]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                {objective && objective.kind !== "develop" && (
                  <p className="crew-spending">
                    Recruitment spent <Amounts value={objective.spent} />
                    <br />
                    Maximum budget <Amounts value={objective.budget} />
                  </p>
                )}
                <div className="crew-job-list">
                  {c.tasks.length ? (
                    c.tasks.map((t) => (
                      <article
                        key={t.id}
                        className={t.blocked ? "blocked" : ""}
                      >
                        <div>
                          {t.kind === "train" ? (
                            <Shield size={19} />
                          ) : t.kind === "collect" ? (
                            <Footprints size={19} />
                          ) : (
                            <Hammer size={19} />
                          )}
                          <h4>{t.label}</h4>
                          <span>
                            {t.blocked
                              ? "Waiting"
                              : t.assignee
                                ? crewRoster.find((r) => r.id === t.assignee)
                                    ?.name
                                : "Open job"}
                          </span>
                        </div>
                        <p>{t.blocked ?? t.reason}</p>
                      </article>
                    ))
                  ) : (
                    <p className="crew-empty">
                      {c.status === "complete"
                        ? "All required work is finished."
                        : "Jobs appear when the objective needs resources, construction or recruits."}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="crew-event-log">
                <h3>Decisions that changed the village</h3>
                <p>
                  Recorded actions and handoffs. Your treasury reflects the same
                  events.
                </p>
                {c.events
                  .slice()
                  .reverse()
                  .map((e) => (
                    <article key={e.id}>
                      <span className={`crew-event-icon ${e.type}`}>
                        {e.type === "action" ? (
                          <Check size={15} />
                        ) : e.type === "adapt" ? (
                          <Handshake size={15} />
                        ) : (
                          <Flag size={15} />
                        )}
                      </span>
                      <div>
                        <small>
                          Tick {e.tick} ·{" "}
                          {crewRoster.find((r) => r.id === e.actor)?.name ??
                            "Village"}
                        </small>
                        <p>{e.text}</p>
                      </div>
                    </article>
                  ))}
                {!c.events.length && (
                  <p className="crew-empty">
                    Set an objective to begin the village log.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
        <footer className="crew-dialog-footer">
          <span>
            <Sparkles size={14} /> Free village simulation
          </span>
          {objective && (
            <button
              onClick={() => {
                onCommand({ type: "cancel" });
                onClose();
              }}
            >
              {c.status === "complete"
                ? "Choose another objective"
                : "Cancel objective"}
            </button>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
