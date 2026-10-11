"use client";
import { Clock, Flag, Home, Star, Trophy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { deploy, retreat } from "@/lib/game/battle";
import { opponents, troops } from "@/lib/game/catalog";
import type { Battle, Game, TroopKind } from "@/lib/game/model";
import { Sprite } from "./scene";
import { Cost } from "./campaign-dialogs";
import { battleStars, destructionPercent } from "./campaign-view-model";

/** The raid: banner, hint with deployment shortcuts, controls, and the results dialog once the battle is settled. */
export function BattleOverlay({
  game,
  battle,
  troop,
  squad,
  onTroop,
  onSquad,
  update,
  onDeployed,
  onReturnHome,
}: {
  game: Game;
  battle: Battle;
  troop: TroopKind;
  squad: number;
  onTroop: (kind: TroopKind) => void;
  onSquad: (n: number) => void;
  update: (fn: (g: Game) => Game) => boolean;
  onDeployed: () => void;
  onReturnHome: () => void;
}) {
  const stars = battleStars(battle);
  const done = battle.result;
  const deployFrom = (zone: string) => {
    if (update((g) => deploy(g, troop, zone, Math.min(squad, g.army[troop]))))
      onDeployed();
  };
  return (
    <>
      <div className="battle-banner">
        <span className="battle-eyebrow">
          Raiding {opponents[battle.level].region}
        </span>
        <h1>{opponents[battle.level].name}</h1>
        <div>
          <span>
            <Clock size={17} />
            {Math.max(0, 90 - Math.floor(battle.elapsed))}s
          </span>
          <span className="battle-stars">
            {[1, 2, 3].map((n) => (
              <Star
                key={n}
                size={25}
                fill={stars >= n ? "#ffc451" : "transparent"}
              />
            ))}
          </span>
          <span>
            {destructionPercent(battle)}% destroyed
          </span>
        </div>
      </div>
      {!done ? (
        <>
          <div className="battle-hint">
            <b>
              {battle.deployed
                ? "Command the battlefield"
                : "Choose your approach"}
            </b>
            <span>
              {battle.deployed
                ? "Tap a building to focus your army’s attack."
                : "Select troops below, then tap a glowing deployment flag."}
            </span>
            <div
              className="deployment-directions"
              aria-label="Deployment shortcuts"
            >
              {["north", "west", "south", "east"].map((zone) => (
                <button
                  key={zone}
                  disabled={!game.army[troop]}
                  aria-label={`Deploy from ${zone} edge`}
                  onClick={() => deployFrom(zone)}
                >
                  <Flag size={12} />
                  {zone}
                </button>
              ))}
            </div>
          </div>
          <div className="battle-controls">
            <button
              className="retreat-button"
              onClick={() => update(retreat)}
            >
              <Flag size={17} />
              End raid
            </button>
            <div className="deployment-army">
              {(Object.keys(troops) as TroopKind[]).map((k) => (
                <button
                  className={`army-card ${troop === k ? "active" : ""}`}
                  key={k}
                  onClick={() => onTroop(k)}
                  disabled={!game.army[k]}
                  aria-label={`Select ${troops[k].name} for deployment`}
                >
                  <Sprite index={troops[k].sprite} />
                  <span className="troop-count">{game.army[k]}</span>
                  <small>{troops[k].name}</small>
                </button>
              ))}
            </div>
            <button
              className="squad-button"
              onClick={() => onSquad(squad === 1 ? 5 : 1)}
            >
              Deploy <b>{squad}</b> at a time
            </button>
          </div>
        </>
      ) : null}

      {done ? (
        <Dialog open onOpenChange={() => {}}>
          <DialogContent
            className="game-dialog results-dialog"
            showCloseButton={false}
          >
            <div className="result-medallion">
              <Trophy size={48} />
            </div>
            <DialogTitle className="game-dialog-title">
              {done && done.stars > 0
                ? "A victorious return."
                : "Live to fight another day."}
            </DialogTitle>
            <DialogDescription>
              {done?.destruction}% of the stronghold destroyed.{" "}
              {done?.stars === 3
                ? "A flawless raid!"
                : "Train, regroup, and try a new approach."}
            </DialogDescription>
            <div className="result-stars">
              {[1, 2, 3].map((n) => (
                <Star
                  key={n}
                  size={56}
                  fill={(done?.stars ?? 0) >= n ? "#ffc451" : "#364557"}
                />
              ))}
            </div>
            <div className="loot-summary">
              <span>Your spoils</span>
              <Cost
                cost={
                  done
                    ? { gold: done.gold, wood: done.wood, food: done.food }
                    : {}
                }
              />
            </div>
            <button className="game-button gold" onClick={onReturnHome}>
              <Home size={20} />
              Return to village
            </button>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
