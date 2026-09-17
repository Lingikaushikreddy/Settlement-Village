"use client";
import { useEffect, useRef, useState } from "react";
import {
  Minus,
  Plus,
  LocateFixed,
  Hammer,
  Coins,
  Wheat,
  TreePine,
  Flag,
  Footprints,
  Coffee,
} from "lucide-react";
import { buildings, troops } from "@/lib/game/catalog";
import { councilLocations } from "@/lib/game/council-map";
import type { CrewAgent } from "@/lib/game/crew-types";
import type { Agent } from "@/lib/sim/types";
import { zones } from "@/lib/game/battle";
import type { Game, BuildingKind } from "@/lib/game/model";
export function Sprite({
  index,
  className = "",
  style = {},
}: {
  index: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={`game-sprite ${className}`}
      style={{
        backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%`,
        ...style,
      }}
    />
  );
}
export const point = (x: number, y: number) => ({
  x: 710 + (x - y) * 64,
  y: 175 + (x + y) * 37,
});
export function Scene({
  game,
  selected,
  placing,
  onSelect,
  onTile,
  onDeploy,
  residents,
  activeIncidents,
  selectedResident,
  onResident,
  readOnly = false,
  crewAgents,
}: {
  game: Game;
  readOnly?: boolean;
  crewAgents?: CrewAgent[];
  residents: Agent[];
  activeIncidents: string[];
  selectedResident: string | null;
  onResident: (id: string) => void;
  selected: string | null;
  placing: BuildingKind | string | null;
  onSelect: (id: string) => void;
  onTile: (x: number, y: number) => void;
  onDeploy: (zone: string) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const [size, setSize] = useState({ w: 1440, h: 900 }),
    [camera, setCamera] = useState({ x: 0, y: 0, z: 1 });
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const observer = new ResizeObserver(([r]) =>
      setSize({ w: r.contentRect.width, h: r.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const scale = Math.max(size.w / 1536, size.h / 1024) * camera.z;
  const battle = game.battle;
  const locations = councilLocations(game);
  const village = battle ? battle.buildings : game.buildings;
  const pathPairs = battle
    ? []
    : game.buildings
        .filter((b) => b.kind !== "hall")
        .map((b) => [
          point(locations.granary.x, locations.granary.y),
          point(b.x, b.y),
        ]);
  return (
    <div
      className="game-stage"
      ref={stage}
      aria-label={
        battle
          ? "Enemy village battlefield"
          : "Your village. Drag empty ground to move the camera."
      }
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        drag.current = {
          x: e.clientX,
          y: e.clientY,
          px: camera.x,
          py: camera.y,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (drag.current)
          setCamera((c) => ({
            ...c,
            x: Math.max(
              -700,
              Math.min(700, drag.current!.px + e.clientX - drag.current!.x),
            ),
            y: Math.max(
              -400,
              Math.min(400, drag.current!.py + e.clientY - drag.current!.y),
            ),
          }));
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <div
        className={`game-world ${battle ? "enemy-world" : ""}`}
        style={{
          transform: `translate(-50%,-50%) translate(${camera.x}px,${camera.y}px) scale(${scale})`,
        }}
      >
        <div className="terrain-art" />
        <svg className="world-paths" viewBox="0 0 1536 1024" aria-hidden="true">
          {pathPairs.map(([a, b], i) => (
            <g key={i}>
              <path
                d={`M${a.x} ${a.y}L${b.x} ${b.y}`}
                stroke="#8f815846"
                strokeWidth="31"
              />
              <path
                d={`M${a.x} ${a.y}L${b.x} ${b.y}`}
                stroke="#d4c787"
                strokeWidth="25"
                strokeDasharray="3 1"
              />
            </g>
          ))}
        </svg>
        {crewAgents &&
          selectedResident &&
          (() => {
            const a = crewAgents.find((a) => a.id === selectedResident),
              task = game.crew?.tasks.find((t) => t.id === a?.task),
              b = game.buildings.find((b) => b.id === task?.buildingId);
            if (!a || !b) return null;
            const from = point(a.x, a.y),
              to = point(b.x, b.y);
            return (
              <svg
                className="crew-route"
                viewBox="0 0 1536 1024"
                aria-hidden="true"
              >
                <path
                  d={`M${from.x} ${from.y}L${to.x} ${to.y}`}
                  stroke="#fff1a8"
                  strokeWidth="4"
                  strokeDasharray="8 9"
                  opacity=".8"
                />
                <circle
                  cx={to.x}
                  cy={to.y}
                  r="20"
                  fill="none"
                  stroke="#ffdf79"
                  strokeWidth="3"
                />
              </svg>
            );
          })()}
        {placing &&
          !battle &&
          Array.from({ length: 81 }, (_, i) => {
            const x = i % 9,
              y = Math.floor(i / 9),
              p = point(x, y),
              occupied = game.buildings.some(
                (b) => b.x === x && b.y === y && b.id !== placing,
              );
            return (
              <button
                key={i}
                disabled={occupied}
                className={`build-tile ${occupied ? "occupied" : ""}`}
                style={{ left: p.x, top: p.y }}
                aria-label={`Place building at ${x}, ${y}`}
                onClick={() => onTile(x, y)}
              />
            );
          })}
        {village.map((b) => {
          const p = point(b.x, b.y),
            def = buildings[b.kind],
            enemy = "hp" in b,
            dead = enemy && b.hp <= 0,
            building = !enemy ? b : undefined,
            buildingReady = building?.readyAt;
          return (
            <div
              key={b.id}
              className={`world-building ${selected === b.id ? "selected" : ""} ${dead ? "destroyed" : ""} ${buildingReady ? "constructing" : ""}`}
              style={{
                left: p.x,
                top: p.y,
                zIndex: 20 + Math.round(p.y),
                width: b.kind === "hall" ? 224 : 174,
              }}
            >
              <span className="building-ground" />
              <button
                className="building-art"
                aria-label={`${enemy ? "Target" : "Select"} ${def.name}${!enemy ? ` level ${b.level}` : ""}`}
                onClick={() => onSelect(b.id)}
                disabled={dead || !!placing || readOnly}
              >
                <Sprite index={def.sprite} />
                {dead ? <span className="rubble">✦</span> : null}
              </button>
              {!dead && enemy ? (
                <div className="enemy-health">
                  <i style={{ width: `${(b.hp / b.maxHp) * 100}%` }} />
                </div>
              ) : null}
              {!enemy && !placing ? (
                <>
                  {def.resource &&
                  b.stored >= 15 &&
                  !buildingReady &&
                  !readOnly ? (
                    <button
                      className={`collect-bubble ${def.resource}`}
                      onClick={() => onSelect(`collect:${b.id}`)}
                      aria-label={`Collect ${Math.floor(b.stored)} ${def.resource}`}
                    >
                      {def.resource === "gold" ? (
                        <Coins size={18} />
                      ) : def.resource === "wood" ? (
                        <TreePine size={18} />
                      ) : (
                        <Wheat size={18} />
                      )}
                      <b>{Math.floor(b.stored)}</b>
                    </button>
                  ) : null}
                  {buildingReady ? (
                    <span className="construction-time">
                      <Hammer size={13} />
                      {Math.ceil(buildingReady - game.clock)}s
                    </span>
                  ) : (
                    <span className="building-level">
                      {def.name} <b>{b.level}</b>
                    </span>
                  )}
                </>
              ) : null}
              {battle?.focus === b.id && !dead ? (
                <Flag className="focus-flag" size={30} />
              ) : null}
            </div>
          );
        })}
        {!battle && !placing && (
          <>
            {(["market", "well"] as const).map((location) => {
              const p = point(locations[location].x, locations[location].y);
              return (
                <div
                  className="civic-landmark"
                  key={location}
                  style={{ left: p.x, top: p.y, zIndex: 20 + Math.round(p.y) }}
                  aria-hidden="true"
                >
                  {location === "well" ? (
                    <svg viewBox="0 0 90 80">
                      <ellipse
                        cx="45"
                        cy="66"
                        rx="31"
                        ry="10"
                        fill="#475c3c"
                        opacity=".3"
                      />
                      <path
                        d="M20 48 Q45 65 70 48 V62 Q45 79 20 62Z"
                        fill="#9ba99a"
                        stroke="#5b736b"
                        strokeWidth="2"
                      />
                      <ellipse cx="45" cy="48" rx="25" ry="10" fill="#d2d4b6" />
                      <ellipse cx="45" cy="49" rx="17" ry="6" fill="#3e788e" />
                      <path
                        d="M25 48V22M65 48V22"
                        stroke="#a3734e"
                        strokeWidth="6"
                      />
                      <path
                        d="M10 27L44 6L80 27L47 40Z"
                        fill="#799fc0"
                        stroke="#487293"
                        strokeWidth="2"
                      />
                      <path d="M44 6L47 40L80 27Z" fill="#426b96" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 90 80">
                      <ellipse
                        cx="45"
                        cy="68"
                        rx="36"
                        ry="9"
                        fill="#475c3c"
                        opacity=".25"
                      />
                      <path
                        d="M19 57L50 71L78 56V43L48 53L19 42Z"
                        fill="#a97b48"
                      />
                      <path d="M18 44L47 29L79 43L49 58Z" fill="#e5b967" />
                      <path
                        d="M18 57V24M78 55V23"
                        stroke="#715837"
                        strokeWidth="5"
                      />
                      <path
                        d="M10 26L41 9L85 26L51 43Z"
                        fill="#dfb85e"
                        stroke="#a17740"
                        strokeWidth="2"
                      />
                      <path d="M25 18L38 12L71 33L57 40Z" fill="#bb6960" />
                      <path d="M45 10L58 16L85 26L73 32Z" fill="#bb6960" />
                      <circle cx="37" cy="45" r="5" fill="#8ba457" />
                      <circle cx="49" cy="49" r="5" fill="#ad5c49" />
                      <circle cx="61" cy="44" r="5" fill="#8ba457" />
                    </svg>
                  )}
                  <span>
                    {location === "market" ? "Market square" : "Willow well"}
                  </span>
                </div>
              );
            })}
            {residents.map((a, i) => {
              const location =
                locations[a.location as keyof typeof locations] ??
                locations.market;
              const crewAgent = crewAgents?.find((c) => c.id === a.id);
              const at = crewAgent
                ? point(crewAgent.x, crewAgent.y)
                : point(location.x, location.y);
              const neighbors = residents.filter((b) => {
                const other = crewAgents?.find((c) => c.id === b.id);
                return crewAgent
                  ? other?.x === crewAgent.x && other?.y === crewAgent.y
                  : b.location === a.location;
              });
              const order = neighbors.findIndex((b) => b.id === a.id);
              const p = {
                x: at.x + (order - (neighbors.length - 1) / 2) * 48,
                y: at.y + (crewAgent ? 10 : 54) + (order % 2) * 8,
              };
              return (
                <button
                  key={a.id}
                  className={`sim-resident ${crewAgent ? "crew-resident" : ""} ${a.id === selectedResident ? "selected" : ""}`}
                  style={{ left: p.x, top: p.y, zIndex: 25 + Math.round(p.y) }}
                  onClick={() => onResident(a.id)}
                  aria-label={
                    crewAgent
                      ? `Inspect ${a.name}, ${crewAgent.status}: ${crewAgent.reason}`
                      : `Inspect ${a.name}, ${a.occupation}, at ${a.location}: ${a.goal}`
                  }
                >
                  <Sprite
                    index={i % 2 ? 6 : 7}
                    style={
                      a.role === "chaos"
                        ? {
                            filter:
                              "hue-rotate(90deg) drop-shadow(0 3px 2px #20322855)",
                          }
                        : undefined
                    }
                  />
                  <b>{a.name}</b>
                  {crewAgent?.task && (
                    <span
                      className="crew-task-badge"
                      aria-label={crewAgent.status}
                    >
                      {crewAgent.status === "moving" ? (
                        <Footprints size={11} />
                      ) : (
                        <Hammer size={11} />
                      )}
                    </span>
                  )}
                  {crewAgent?.status === "resting" && (
                    <span className="crew-task-badge">
                      <Coffee size={11} />
                    </span>
                  )}
                  {activeIncidents.includes(a.id) && (
                    <span
                      className="resident-alert"
                      aria-label="Claim received"
                    >
                      !
                    </span>
                  )}
                </button>
              );
            })}
          </>
        )}
        {battle?.units
          .filter((u) => u.hp > 0)
          .map((u) => {
            const p = point(u.x, u.y);
            return (
              <div
                className={`battle-unit ${u.attacking ? "attacking" : "walking"}`}
                key={u.id}
                style={{ left: p.x, top: p.y, zIndex: 1000 + Math.round(p.y) }}
              >
                <Sprite index={troops[u.kind].sprite} />
                <span className="unit-health">
                  <i style={{ width: `${(u.hp / u.maxHp) * 100}%` }} />
                </span>
                {u.attacking ? <span className="hit-spark">✦</span> : null}
              </div>
            );
          })}
        {battle && !battle.result ? (
          <>
            <svg
              className="projectile-layer"
              viewBox="0 0 1536 1024"
              aria-hidden="true"
            >
              {battle.units
                .filter((u) => u.hp > 0 && u.attacking && u.kind !== "knight")
                .map((u) => {
                  const t = battle.buildings.find((b) => b.id === u.target);
                  if (!t) return null;
                  const a = point(u.x, u.y),
                    b = point(t.x, t.y);
                  return (
                    <path
                      key={u.id}
                      d={`M${a.x} ${a.y - 20} Q${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - 90} ${b.x} ${b.y - 50}`}
                      className={
                        u.kind === "archer" ? "arrow-flight" : "stone-flight"
                      }
                    />
                  );
                })}
            </svg>
            {Object.entries(zones).map(([zone, coord]) => {
              const p = point(coord.x, coord.y);
              return (
                <button
                  className="deploy-zone"
                  key={zone}
                  style={{ left: p.x, top: p.y, zIndex: 2000 }}
                  onClick={() => onDeploy(zone)}
                  aria-label={`Deploy troops from ${zone}`}
                >
                  <Plus size={22} />
                  <span>{zone}</span>
                </button>
              );
            })}
          </>
        ) : null}
        <div className="world-vignette" />
      </div>
      <div className="camera-controls">
        <button
          aria-label="Zoom out"
          onClick={() =>
            setCamera((c) => ({ ...c, z: Math.max(0.65, c.z - 0.15) }))
          }
        >
          <Minus size={18} />
        </button>
        <button
          aria-label="Center village"
          onClick={() => setCamera({ x: 0, y: 0, z: 1 })}
        >
          <LocateFixed size={18} />
        </button>
        <button
          aria-label="Zoom in"
          onClick={() =>
            setCamera((c) => ({ ...c, z: Math.min(1.75, c.z + 0.15) }))
          }
        >
          <Plus size={18} />
        </button>
        <span>Drag to explore</span>
      </div>
    </div>
  );
}
