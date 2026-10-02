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
import { crewRoute } from "@/lib/game/crew";
import type { CrewAgent } from "@/lib/game/crew-types";
import type { Agent } from "@/lib/sim/types";
import { zones } from "@/lib/game/battle";
import type { Game, BuildingKind } from "@/lib/game/model";
import { ResidentAvatar } from "./resident-avatar";
import "./world-upgrade.css";
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
  const [size, setSize] = useState({
      w: 1440,
      h: 900,
      top: 150,
      bottom: 160,
      left: 24,
      right: 24,
    }),
    [camera, setCamera] = useState({ x: 0, y: 0, z: 1 });
  const battle = game.battle;
  const isBattle = !!battle;
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const { width: w, height: h } = el.getBoundingClientRect();
      const styles = getComputedStyle(el);
      const margin = (side: string, fallback: number) => {
        const value = Number.parseFloat(
          styles.getPropertyValue(`--world-safe-${side}`),
        );
        return Number.isFinite(value) ? value : fallback;
      };
      const compact = w <= 760;
      setSize({
        w,
        h,
        top: margin("top", readOnly ? 45 : compact ? 172 : 150),
        bottom: margin("bottom", readOnly ? 38 : compact ? 148 : 160),
        left: margin("left", compact ? 20 : 30),
        right: margin("right", compact ? 20 : 30),
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [readOnly, placing, isBattle]);
  const locations = councilLocations(game);
  const village = battle ? battle.buildings : game.buildings;
  const worldPoints = placing
    ? [point(0, 0), point(0, 8), point(8, 0), point(8, 8)]
    : [
        ...village.map((b) => point(b.x, b.y)),
        ...(battle
          ? Object.values(zones).map((p) => point(p.x, p.y))
          : [
              point(locations.market.x, locations.market.y),
              point(locations.well.x, locations.well.y),
            ]),
      ];
  const bounds = {
    left: Math.min(...worldPoints.map((p) => p.x)) - 115,
    right: Math.max(...worldPoints.map((p) => p.x)) + 115,
    top: Math.min(...worldPoints.map((p) => p.y)) - 230,
    bottom: Math.max(...worldPoints.map((p) => p.y)) + 65,
  };
  const fit = Math.min(
    1.25,
    Math.max(160, size.w - size.left - size.right) /
      (bounds.right - bounds.left),
    Math.max(120, size.h - size.top - size.bottom) /
      (bounds.bottom - bounds.top),
  );
  const scale = fit * camera.z;
  const center = {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
  };
  const offset = {
    x: (768 - center.x) * scale + (size.left - size.right) / 2 + camera.x,
    y: (512 - center.y) * scale + (size.top - size.bottom) / 2 + camera.y,
  };
  const panLimit = {
    x: Math.max(size.w / 2, 700 * scale),
    y: Math.max(size.h / 2, 500 * scale),
  };
  const zoom = (change: number) =>
    setCamera((c) => ({
      ...c,
      z: Math.max(0.65, Math.min(2.5, c.z + change)),
    }));
  const resetCamera = () => setCamera({ x: 0, y: 0, z: 1 });
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
      className={`game-stage world-upgrade ${placing ? "world-placement" : ""}`}
      ref={stage}
      role="region"
      tabIndex={0}
      aria-label={
        battle
          ? "Enemy village battlefield"
          : "Your village. Drag empty ground or use arrow keys to explore. Plus and minus zoom. Home fits the village."
      }
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        const directions: Record<string, { x: number; y: number }> = {
          ArrowLeft: { x: 64, y: 0 },
          ArrowRight: { x: -64, y: 0 },
          ArrowUp: { x: 0, y: 64 },
          ArrowDown: { x: 0, y: -64 },
        };
        const direction = directions[e.key];
        if (direction) {
          e.preventDefault();
          setCamera((c) => ({
            ...c,
            x: Math.max(-panLimit.x, Math.min(panLimit.x, c.x + direction.x)),
            y: Math.max(-panLimit.y, Math.min(panLimit.y, c.y + direction.y)),
          }));
        } else if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          zoom(0.2);
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          zoom(-0.2);
        } else if (e.key === "Home") {
          e.preventDefault();
          resetCamera();
        }
      }}
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
              -panLimit.x,
              Math.min(
                panLimit.x,
                drag.current!.px + e.clientX - drag.current!.x,
              ),
            ),
            y: Math.max(
              -panLimit.y,
              Math.min(
                panLimit.y,
                drag.current!.py + e.clientY - drag.current!.y,
              ),
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
          transform: `translate(-50%,-50%) translate(${offset.x}px,${offset.y}px) scale(${scale})`,
        }}
      >
        <div
          className="terrain-art"
          style={{
            transform: `scale(${Math.max(1, (size.w + 2 * Math.abs(offset.x)) / (1536 * scale), (size.h + 2 * Math.abs(offset.y)) / (1024 * scale))})`,
          }}
        />
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
              building = game.buildings.find((b) => b.id === task?.buildingId),
              target =
                building ??
                (task?.x !== undefined && task.y !== undefined
                  ? { x: task.x, y: task.y }
                  : null),
              route = a ? crewRoute(game, a.id) : null;
            if (!a || !target || route === null) return null;
            const steps = [a, ...route].map((p) => point(p.x, p.y)),
              routePath = steps
                .map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`)
                .join(" "),
              to = point(target.x, target.y),
              arrival = steps[steps.length - 1];
            return (
              <svg
                className="crew-route"
                viewBox="0 0 1536 1024"
                aria-hidden="true"
              >
                <path d={routePath} className="world-route-underlay" />
                <path d={routePath} className="world-route-line" />
                <circle cx={arrival.x} cy={arrival.y} r="6" fill="#ffe4a0" />
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
            buildingReady = building?.readyAt,
            buildDuration = building?.constructing
              ? def.seconds
              : def.seconds * ((building?.level ?? 1) + 1),
            buildProgress = buildingReady
              ? Math.max(
                  0,
                  Math.min(
                    100,
                    (1 - (buildingReady - game.clock) / buildDuration) * 100,
                  ),
                )
              : 100;
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
                    <span className="construction-time world-construction">
                      <span className="world-construction-label">
                        <Hammer size={13} />
                        {building?.constructing ? "Building" : "Upgrading"}
                        <b>
                          {Math.max(0, Math.ceil(buildingReady - game.clock))}s
                        </b>
                      </span>
                      <span
                        className="world-construction-progress"
                        role="progressbar"
                        aria-label={`${def.name} ${building?.constructing ? "construction" : "upgrade"}`}
                        aria-valuenow={Math.floor(buildProgress)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <i style={{ width: `${buildProgress}%` }} />
                      </span>
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
                  {a.role === "chaos" ? (
                    <Sprite
                      index={i % 2 ? 6 : 7}
                      style={{
                        filter:
                          "hue-rotate(90deg) drop-shadow(0 3px 2px #20322855)",
                      }}
                    />
                  ) : (
                    <ResidentAvatar id={a.id} variant="full" size={76} />
                  )}
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
      </div>
      <div className="world-vignette" />
      <div className="camera-controls" aria-label="Map camera controls">
        <button
          aria-label="Zoom out"
          title="Zoom out (−)"
          disabled={camera.z <= 0.65}
          onClick={() => zoom(-0.2)}
        >
          <Minus size={18} />
        </button>
        <button
          aria-label="Center village"
          title="Fit village (Home)"
          onClick={resetCamera}
        >
          <LocateFixed size={18} />
        </button>
        <button
          aria-label="Zoom in"
          title="Zoom in (+)"
          disabled={camera.z >= 2.5}
          onClick={() => zoom(0.2)}
        >
          <Plus size={18} />
        </button>
        <span className="camera-hint">Drag to explore · Arrow keys to pan</span>
      </div>
    </div>
  );
}
