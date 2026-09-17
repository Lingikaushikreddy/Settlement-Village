"use client";
import { useState } from "react";
import {
  ArrowRight,
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
import type { Game, Resources } from "@/lib/game/model";
import type { CrewCommand } from "@/lib/game/crew-types";
import {
  crewRoster,
  crewPreview,
  crewProgress,
  newCrew,
} from "@/lib/game/crew";
import "./crew.css";
const icons = { gold: Coins, wood: TreePine, food: Wheat };
const resourceName = { gold: "gold", wood: "timber", food: "food" };
const title = { raid: "Prepare for a raid", stockpile: "Restock the village" };
function Amounts({ value }: { value: Resources }) {
  return (
    <span className="crew-amounts">
      {Object.entries(value)
        .filter(([, n]) => n > 0)
        .map(([r, n]) => {
          const key = r as keyof Resources,
            Icon = icons[key];
          return (
            <span key={r}>
              <Icon size={13} />
              {Math.ceil(n)} <span>{resourceName[key]}</span>
            </span>
          );
        })}
    </span>
  );
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
  const [collapsed, setCollapsed] = useState(false);
  const crew = game.crew,
    objective = crew?.objective,
    latestEvent = crew?.events.at(-1),
    preview = crewPreview(game, "raid"),
    progress = crewProgress(game);
  return (
    <aside className="crew-board" aria-label="Village orders">
      <button
        className="crew-board-heading"
        aria-label={
          collapsed ? "Expand village orders" : "Collapse village orders"
        }
        aria-expanded={!collapsed}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span>
          <Users size={16} /> Village orders
        </span>
        {collapsed ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
      </button>
      {collapsed && (
        <button
          className="crew-collapsed-summary"
          onClick={() => setCollapsed(false)}
        >
          {objective ? title[objective.kind] : "Choose a village objective"}
          {objective && (
            <span>
              {progress.percent}% ·{" "}
              {crew.status === "complete"
                ? "Complete"
                : crew.playing
                  ? "Working"
                  : "Paused"}
            </span>
          )}
        </button>
      )}
      <div className="crew-board-body" hidden={collapsed}>
        {!objective ? (
          <>
            <h2>
              A purpose for
              <br />
              every person.
            </h2>
            <p>Set the goal. Your residents organize the work.</p>
            <button
              className="crew-start"
              onClick={() => onCommand({ type: "start", kind: "raid" })}
            >
              <Shield size={20} />
              <span>
                <b>Prepare for a raid</b>
                <small>30 ready troops + village reserves</small>
              </span>
              <ArrowRight size={17} />
            </button>
            <p className="crew-budget">
              Recruitment budget <Amounts value={preview.budget} />
              {Object.values(preview.budget).every((n) => n === 0) && (
                <span>No recruits needed</span>
              )}
            </p>
            <button
              className="crew-stockpile"
              onClick={() => onCommand({ type: "start", kind: "stockpile" })}
            >
              <Wheat size={15} /> Restock supplies <span>+300 each</span>
            </button>
          </>
        ) : (
          <>
            <div className="crew-objective-title">
              <Flag size={19} />
              <div>
                <h2>{title[objective.kind]}</h2>
                <span>
                  {crew.status === "complete"
                    ? "Objective complete"
                    : crew.playing
                      ? "Agents are coordinating"
                      : "Crew paused"}
                </span>
              </div>
            </div>
            <div className="crew-progress-label">
              <span>
                {objective.kind === "raid"
                  ? `${progress.readyTroops} / ${progress.targetTroops} troops ready`
                  : "Village reserves"}
              </span>
              <b>{progress.percent}%</b>
            </div>
            <div
              className="crew-progress"
              role="progressbar"
              aria-label="Objective progress"
              aria-valuenow={progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <i style={{ width: `${progress.percent}%` }} />
            </div>
            <div className="crew-mini-roster">
              {crewRoster.map((r) => {
                const a = crew.agents.find((a) => a.id === r.id)!;
                return (
                  <button
                    key={r.id}
                    onClick={() => onInspect(r.id)}
                    aria-label={`Inspect ${r.name}'s work`}
                    title={`${r.name}: ${a.reason}`}
                  >
                    <span style={{ background: r.color }}>{r.name[0]}</span>
                    <i className={`crew-dot ${a.status}`} />
                    <small>{r.name}</small>
                  </button>
                );
              })}
            </div>
            <p className="crew-live-note">
              {crew.status === "complete"
                ? "Your crew finished the objective. You choose what comes next."
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
                  {crew.playing ? <Pause size={14} /> : <Play size={14} />}{" "}
                  {crew.playing ? "Pause crew" : "Resume crew"}
                </button>
              ) : objective.kind === "raid" ? (
                <button onClick={onRaid}>
                  <Shield size={14} /> Scout a raid
                </button>
              ) : (
                <button
                  onClick={() => onCommand({ type: "start", kind: "raid" })}
                >
                  <Shield size={14} /> Prepare a raid
                </button>
              )}
              <button onClick={() => onInspect()}>
                View plan <ArrowRight size={14} />
              </button>
            </div>
          </>
        )}
        <button className="crew-council-link" onClick={onCouncil}>
          <BookOpen size={13} /> Council stories <ChevronRight size={13} />
        </button>
      </div>
    </aside>
  );
}
export function CrewInspector({
  game,
  selected,
  onSelected,
  onCommand,
  onClose,
}: {
  game: Game;
  selected: string;
  onSelected: (id: string) => void;
  onCommand: (c: CrewCommand) => void;
  onClose: () => void;
}) {
  const c = game.crew ?? newCrew(game),
    person = crewRoster.find((a) => a.id === selected) ?? crewRoster[0],
    agent = c.agents.find((a) => a.id === person.id)!;
  const [view, setView] = useState<"agent" | "jobs" | "history">("agent");
  const objective = c.objective,
    progress = crewProgress(game),
    task = c.tasks.find((t) => t.id === agent.task);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="crew-dialog" showCloseButton={false}>
        <header className="crew-dialog-heading">
          <div>
            <span>
              <Handshake size={16} /> The village crew
            </span>
            <DialogTitle>One objective. Six minds at work.</DialogTitle>
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
                ? `${progress.percent}% complete · ${c.status === "complete" ? "Finished" : c.playing ? "Live coordination" : "Paused"}`
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
                  <span className="crew-avatar" style={{ background: r.color }}>
                    {r.name[0]}
                  </span>
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
                  ["jobs", "Shared jobs"],
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
                  <span
                    className="crew-avatar large"
                    style={{ background: person.color }}
                  >
                    {person.name[0]}
                  </span>
                  <div>
                    <h3>{person.name}</h3>
                    <p>
                      {person.role} · {person.specialty}
                    </p>
                  </div>
                  <span className={`crew-status-pill ${agent.status}`}>
                    {agent.status}
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
                  <h3>A shared plan, exclusive jobs.</h3>
                  <p>
                    Residents choose useful work by role, distance and demand.
                    Each job has one owner.
                  </p>
                </div>
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
                {objective && (
                  <p className="crew-spending">
                    Recruitment spent <Amounts value={objective.spent} />
                    {Object.values(objective.spent).every((n) => n === 0) && (
                      <span>0</span>
                    )}
                    <br />
                    Maximum budget <Amounts value={objective.budget} />
                    {Object.values(objective.budget).every((n) => n === 0) && (
                      <span>No spending</span>
                    )}
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
                          ) : (
                            <Footprints size={19} />
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
                        : "Jobs appear when the objective needs resources or recruits."}
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
            <Sparkles size={14} /> Free agent policies · no model calls
          </span>
          {objective && (
            <button onClick={() => onCommand({ type: "cancel" })}>
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
