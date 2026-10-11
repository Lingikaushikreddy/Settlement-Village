"use client";
import { ChevronRight, Hammer, Shield, Swords, Trophy } from "lucide-react";
import { quests, troops } from "@/lib/game/catalog";
import type { Command, Game, TroopKind } from "@/lib/game/model";
import type { CrewCommand } from "@/lib/game/crew-types";
import { Sprite } from "./scene";
import { CrewBoard } from "./crew";
import { VillageJournal } from "./village-journal";
import { armyTotal } from "./campaign-view-model";
import type { Panel } from "./campaign-dialogs";

/** Everything below the map while the village is at peace: crew board, journal, league badge, army dock and the Build / Battle buttons. */
export function CampaignFooter({
  game,
  act,
  crewAct,
  onInspect,
  onCouncil,
  onPanel,
  onSelect,
  onNotice,
}: {
  game: Game;
  act: (c: Command, message?: string) => boolean;
  crewAct: (c: CrewCommand) => boolean;
  onInspect: (id?: string) => void;
  onCouncil: () => void;
  onPanel: (panel: Panel) => void;
  onSelect: (id: string | null) => void;
  onNotice: (text: string) => void;
}) {
  function quest(id: string) {
    const q = quests.find((entry) => entry.id === id);
    if (!q) return;
    if (game.stats[q.stat] >= q.goal)
      act({ type: "claim", id }, `Milestone complete! +${q.reward} gold`);
    else if (id === "build") onPanel("build");
    else if (id === "raid") onPanel("raid");
    else if (id === "upgrade") onSelect("hall");
    else onNotice("Tap the resource bubbles above your mine, mill and farm.");
  }
  return (
    <>
      <CrewBoard
        game={game}
        onCommand={crewAct}
        onInspect={onInspect}
        onCouncil={onCouncil}
        onRaid={() => onPanel("raid")}
      />
      <VillageJournal
        game={game}
        onResident={onInspect}
        onGuide={() => onPanel("guide")}
        onQuest={quest}
      />
      <div className="village-badge">
        <Trophy size={17} />
        <strong>{game.trophies}</strong>
        <span>Explorer league</span>
      </div>
      <footer className="game-bottom">
        <div className="army-dock">
          <button
            className="army-heading"
            onClick={() => onPanel("train")}
          >
            <Shield size={16} />
            <span>
              Your army{" "}
              <b>{armyTotal(game)}/40</b>
            </span>
            <ChevronRight size={16} />
          </button>
          <div className="army-cards">
            {(Object.keys(troops) as TroopKind[]).map((k) => (
              <button
                className="army-card"
                key={k}
                onClick={() => onPanel("train")}
                aria-label={`Train ${troops[k].name}, ${game.army[k]} ready`}
              >
                <Sprite index={troops[k].sprite} />
                <span className="troop-count">{game.army[k]}</span>
                <small>{troops[k].name}</small>
              </button>
            ))}
            <button
              className="train-more"
              onClick={() => onPanel("train")}
            >
              <Hammer size={19} />
              <span>Train</span>
              {game.training.length ? (
                <b>{game.training.length} queued</b>
              ) : null}
            </button>
          </div>
        </div>
        <div className="village-actions">
          <button
            className="game-button blue build-button"
            onClick={() => {
              onPanel("build");
              onSelect(null);
            }}
          >
            <Hammer />
            <span>
              Build<small>Grow your village</small>
            </span>
          </button>
          <button
            className="game-button gold battle-button"
            onClick={() => {
              onPanel("raid");
              onSelect(null);
            }}
          >
            <Swords />
            <span>
              Battle<small>Adventure awaits</small>
            </span>
            <ChevronRight />
          </button>
        </div>
      </footer>
    </>
  );
}
