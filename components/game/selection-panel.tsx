"use client";
import { ArrowUp, Hammer, Move, X } from "lucide-react";
import { actionProblem } from "@/lib/game/action-availability";
import { buildings, upgradeCost } from "@/lib/game/catalog";
import type { Building, Command, Game } from "@/lib/game/model";
import { Sprite } from "./scene";
import { Cost } from "./campaign-shared";
import { buildingSummary, placementTitle } from "./campaign-view-model";

/** The placement notice while placing, else the panel for the selected building. */
export function SelectionPanel({
  game,
  placing,
  building,
  act,
  onCancelPlacing,
  onClose,
  onTrain,
  onMove,
}: {
  game: Game;
  placing: string | null;
  building: Building | undefined;
  act: (c: Command, message?: string) => boolean;
  onCancelPlacing: () => void;
  onClose: () => void;
  onTrain: () => void;
  onMove: (id: string) => void;
}) {
  if (placing)
    return (
      <div className="placement-notice">
        <Hammer size={20} />
        <div>
          <b>{placementTitle(game, placing)}</b>
          <span>Tap an empty diamond. Drag the map to explore.</span>
        </div>
        <button onClick={onCancelPlacing} aria-label="Cancel placement">
          <X />
        </button>
      </div>
    );
  if (!building) return null;
  const def = buildings[building.kind];
  const upgradeProblem = actionProblem(game, {
    type: "upgrade",
    id: building.id,
  });
  return (
    <section className="building-panel">
      <button
        className="panel-close"
        onClick={onClose}
        aria-label="Close building details"
      >
        <X size={18} />
      </button>
      <Sprite index={def.sprite} />
      <div className="building-info">
        <small>
          Level {building.level}
          {building.readyAt ? " · Builder working" : ""}
        </small>
        <h2>{def.name}</h2>
        <p>{buildingSummary(game, building)}</p>
      </div>
      <div className="building-actions">
        {def.resource ? (
          <button
            className="game-button gold small"
            onClick={() =>
              act({ type: "collect", id: building.id }, "Resources collected!")
            }
            disabled={building.stored < 1}
          >
            Collect{" "}
            <Cost cost={{ [def.resource]: Math.floor(building.stored) }} />
          </button>
        ) : building.kind === "barracks" ? (
          <button className="game-button blue small" onClick={onTrain}>
            Train troops
          </button>
        ) : null}
        <button
          className="game-button green small"
          disabled={!!upgradeProblem}
          aria-describedby={upgradeProblem ? "upgrade-problem" : undefined}
          onClick={() =>
            act({ type: "upgrade", id: building.id }, "Upgrade started!")
          }
        >
          <ArrowUp size={16} />
          Upgrade{" "}
          {building.level < 5 ? (
            <Cost cost={upgradeCost(building.kind, building.level)} />
          ) : null}
        </button>
        <button
          className="move-button"
          aria-label={`Move ${def.name}`}
          disabled={!!building.readyAt}
          onClick={() => onMove(building.id)}
        >
          <Move size={20} />
        </button>
      </div>
      {upgradeProblem && (
        <p id="upgrade-problem" className="action-problem building-problem">
          {upgradeProblem}
        </p>
      )}
    </section>
  );
}
