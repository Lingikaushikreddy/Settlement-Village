"use client";
import {
  ChevronRight,
  Clock,
  Coins,
  Hammer,
  Lock,
  Shield,
  Swords,
  TreePine,
  Wheat,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { actionProblem, buildProblem } from "@/lib/game/action-availability";
import { startBattle } from "@/lib/game/battle";
import {
  armySize,
  buildings,
  freeBuilders,
  opponents,
  troops,
} from "@/lib/game/catalog";
import type {
  BuildingKind,
  Command,
  Game,
  Resources,
  TroopKind,
} from "@/lib/game/model";
import { Sprite } from "./scene";
import { Guide, type GuideProps } from "./guide";

export type Panel = "build" | "train" | "raid" | "guide";

const resourceIcons = { gold: Coins, wood: TreePine, food: Wheat };

export function Cost({ cost }: { cost: Partial<Resources> }) {
  return (
    <span className="game-cost">
      {Object.entries(cost)
        .filter(([, n]) => n! > 0)
        .map(([r, n]) => {
          const Icon = resourceIcons[r as keyof Resources];
          return (
            <span key={r}>
              <Icon size={14} />
              {Math.floor(n!)}
            </span>
          );
        })}
    </span>
  );
}

export function download(g: Game) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(
      new Blob([JSON.stringify(g, null, 2)], { type: "application/json" }),
    );
  a.href = url;
  a.download = "Settlement-village.json";
  a.click();
  URL.revokeObjectURL(url);
}

const titles: Record<Panel, string> = {
  build: "Make room for possibility.",
  train: "Your army starts here.",
  raid: "Beyond the treeline.",
  guide: "Welcome home, chief.",
};

/** The build, train, raid and guide dialog. Rendered only while a panel is open. */
export function CampaignDialogs({
  panel,
  game,
  act,
  update,
  onClose,
  onPlace,
  onScouted,
  guide,
}: {
  panel: Panel | null;
  game: Game;
  act: (c: Command, message?: string) => boolean;
  update: (fn: (g: Game) => Game) => boolean;
  onClose: () => void;
  onPlace: (kind: BuildingKind) => void;
  onScouted: () => void;
  guide: GuideProps;
}) {
  if (panel === null) return null;
  const description =
    panel === "build"
      ? `${freeBuilders(game)} of 2 builders available. Choose a building, then place it in your village.`
      : panel === "train"
        ? `${armySize(game)} / 40 camp spaces used. Training continues while you explore.`
        : panel === "raid"
          ? "Scout a stronghold, deploy your troops, and bring the spoils home."
          : "Build a thriving village and lead your troops into battle.";
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="game-dialog">
        <DialogTitle className="game-dialog-title">{titles[panel]}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {panel === "build" ? (
        <div className="build-shop">
          {(Object.keys(buildings) as BuildingKind[])
            .filter((k) => k !== "hall")
            .map((k) => (
              <button
                className="shop-item"
                key={k}
                disabled={!!buildProblem(game, k)}
                onClick={() => onPlace(k)}
              >
                <Sprite index={buildings[k].sprite} />
                <h3>{buildings[k].name}</h3>
                <span>
                  <Clock size={12} />
                  {buildings[k].seconds}s to build
                </span>
                <Cost cost={buildings[k].cost} />
                <b className="shop-cta">
                  {buildProblem(game, k) || (
                    <>
                      Place building <ChevronRight size={13} />
                    </>
                  )}
                </b>
              </button>
            ))}
        </div>
        ) : null}
        {panel === "train" ? (
        <>
          <div className="training-shop">
            {(Object.keys(troops) as TroopKind[]).map((k) => (
              <article className="training-card" key={k}>
                <Sprite index={troops[k].sprite} />
                <h3>{troops[k].name}</h3>
                <p>{troops[k].role}</p>
                <div className="troop-stats">
                  <span>
                    <Shield size={13} />
                    {troops[k].hp}
                  </span>
                  <span>
                    <Swords size={13} />
                    {troops[k].damage}/s
                  </span>
                </div>
                <Cost cost={troops[k].cost} />
                <button
                  className="game-button blue small"
                  disabled={
                    !!actionProblem(game, {
                      type: "train",
                      kind: k,
                      count: 1,
                    })
                  }
                  aria-describedby={`train-${k}-problem`}
                  onClick={() =>
                    act(
                      { type: "train", kind: k, count: 1 },
                      `${troops[k].name} added to training.`,
                    )
                  }
                >
                  Train 1 · {troops[k].seconds}s
                </button>
                <button
                  className="train-five"
                  disabled={
                    !!actionProblem(game, {
                      type: "train",
                      kind: k,
                      count: 5,
                    })
                  }
                  aria-describedby={`train-${k}-problem`}
                  onClick={() =>
                    act(
                      { type: "train", kind: k, count: 5 },
                      `Five ${troops[k].plural} queued.`,
                    )
                  }
                >
                  Queue 5
                </button>
                <p className="action-problem" id={`train-${k}-problem`}>
                  {actionProblem(game, {
                    type: "train",
                    kind: k,
                    count: 1,
                  }) ||
                    (actionProblem(game, {
                      type: "train",
                      kind: k,
                      count: 5,
                    })
                      ? `Queue 5: ${actionProblem(game, { type: "train", kind: k, count: 5 })}`
                      : "")}
                </p>
              </article>
            ))}
          </div>
          <div className="training-queue">
            <Hammer size={18} />
            {game.training.length ? (
              <>
                <b>{game.training.length} training</b>
                <span>
                  Next {troops[game.training[0].kind].noun} in{" "}
                  {Math.max(
                    1,
                    Math.ceil(game.training[0].readyAt - game.clock),
                  )}
                  s
                </span>
              </>
            ) : (
              <span>
                The training queue is clear. Ready when you are.
              </span>
            )}
          </div>
        </>
        ) : null}
        {panel === "raid" ? (
        <div className="raid-list">
          {opponents.map((o, i) => (
            <article
              className={`raid-option ${i > game.unlocked ? "locked" : ""}`}
              key={o.name}
            >
              <div className="raid-illustration">
                <Sprite index={i === 0 ? 5 : i === 1 ? 4 : 0} />
                <span>{i + 1}</span>
              </div>
              <div>
                <small>
                  {o.region} · {o.difficulty}
                </small>
                <h3>{o.name}</h3>
                <Cost
                  cost={{ gold: o.gold, wood: o.wood, food: o.food }}
                />
              </div>
              <button
                className="game-button gold small"
                disabled={
                  i > game.unlocked ||
                  Object.values(game.army).every((n) => n === 0)
                }
                onClick={() => {
                  if (update((g) => startBattle(g, i))) onScouted();
                }}
              >
                {i > game.unlocked ? (
                  <>
                    <Lock size={14} />
                    Locked
                  </>
                ) : (
                  <>
                    Scout <ChevronRight size={14} />
                  </>
                )}
              </button>
            </article>
          ))}
          <p className="raid-note">
            {Object.values(game.army).every((n) => n === 0)
              ? "Train at least one troop before scouting. "
              : ""}
            Deployed troops are spent. Troops left in reserve return home.
            Earn a star to unlock the next stronghold.
          </p>
        </div>
        ) : null}
        {panel === "guide" ? <Guide {...guide} /> : null}
      </DialogContent>
    </Dialog>
  );
}
