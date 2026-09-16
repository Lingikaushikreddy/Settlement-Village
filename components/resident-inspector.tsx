"use client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  PanelRight,
  Wheat,
  Droplets,
  Coins,
  Trees,
  BookOpen,
  ShieldAlert,
} from "lucide-react";
import type { Run } from "@/lib/sim/types";
export function ResidentInspector({
  run,
  tick,
  selected,
  onEvidence,
}: {
  run: Run;
  tick: number;
  selected: string;
  onEvidence: (id: string) => void;
}) {
  const w = run.snapshots[tick],
    a = w.agents.find((x) => x.id === selected) || w.agents[0];
  const d = run.decisions
    .filter((x) => x.actor === a.id && x.tick <= tick)
    .at(-1);
  const memory = w.memories
    .filter((m) => m.owner === a.id)
    .slice(-8)
    .reverse();
  return (
    <aside className="inspector">
      <div className="panel-title">
        <span>Resident inspector</span>
        <PanelRight size={16} />
      </div>
      <div className="resident-heading">
        <span className="avatar" style={{ background: a.color }}>
          {a.name[0]}
        </span>
        <div>
          <h2>{a.name}</h2>
          <p>
            {a.occupation} · {a.location}
          </p>
        </div>
        {a.role === "chaos" && <ShieldAlert className="chaos-icon" size={18} />}
      </div>
      <Tabs defaultValue="decision" className="inspector-tabs">
        <TabsList variant="line" className="inspector-tab-list">
          <TabsTrigger value="decision">Decision</TabsTrigger>
          <TabsTrigger value="memory">Memory</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>
        <TabsContent value="decision">
          <div className="inspector-section">
            <label>Current goal</label>
            <h3>{a.goal}</h3>
            <p>
              {d?.summary ||
                (a.role === "chaos"
                  ? "Rook publishes scenario-defined claims at fixed opportunities."
                  : "The day is beginning. Advance the timeline to see a decision.")}
            </p>
          </div>
          {d && (
            <>
              <div className="inspector-section">
                <label>Selected action · tick {d.tick}</label>
                <strong className="selected-action">{d.selected}</strong>
                {d.plan.length > 0 && (
                  <ol className="plan-list">
                    {d.plan.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ol>
                )}
              </div>
              <div className="inspector-section">
                <label>Evidence used</label>
                {d.evidenceIds.length ? (
                  d.evidenceIds.map((id) => (
                    <button
                      key={id}
                      className="evidence-link"
                      onClick={() => onEvidence(id)}
                    >
                      <BookOpen size={13} />
                      {run.events.find((e) => e.id === id)?.title || id}
                    </button>
                  ))
                ) : (
                  <p>
                    No prior evidence. Uses observed needs and public rules.
                  </p>
                )}
              </div>
            </>
          )}
        </TabsContent>
        <TabsContent value="memory">
          <div className="inspector-section">
            <label>Only {a.name}’s observed evidence</label>
            {memory.length ? (
              memory.map((m) => (
                <button
                  className="memory-item"
                  key={m.id}
                  onClick={() => onEvidence(m.source)}
                >
                  <span>
                    Tick {m.tick} · {m.type}
                  </span>
                  <p>{m.text}</p>
                </button>
              ))
            ) : (
              <p>No memories recorded yet.</p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="inventory">
          <div className="inspector-section">
            <label>In their bag</label>
            {[
              [Wheat, "grain"],
              [Trees, "wood"],
              [Droplets, "water"],
              [Coins, "coins"],
            ].map(([Icon, key]) => {
              const I = Icon as typeof Wheat;
              const k = key as keyof typeof a.inventory;
              return (
                <div className="resource-row" key={k}>
                  <I size={18} />
                  <span>{k}</span>
                  <strong>{a.inventory[k]}</strong>
                </div>
              );
            })}
            <div className="need-label">
              <span>Hunger</span>
              <strong>{a.hunger}/100</strong>
            </div>
            <div className="need-track">
              <div
                style={{
                  width: `${a.hunger}%`,
                  background: a.hunger > 70 ? "#b76a4d" : "#91a774",
                }}
              />
            </div>
            <p className="muted-small">
              Residents plan meals before hunger becomes urgent.
            </p>
          </div>
        </TabsContent>
      </Tabs>
      <div className="inspector-note">
        <BookOpen size={16} />
        <p>
          Decision summary with recorded sources. This inspector is visible to
          you; residents only see their permitted observations.
        </p>
      </div>
    </aside>
  );
}
