"use client";
import {
  BookOpen,
  Clock,
  Hammer,
  Home,
  Shield,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { Game } from "@/lib/game/model";
import { hudFigures } from "./campaign-view-model";
import { resourceIcons } from "./campaign-shared";

/** The top bar: banner, builders, resources, sound; and the settlement navigation while not raiding. */
export function CampaignHud({
  game,
  raiding,
  sound,
  onSound,
  onGuide,
  researchSection,
  councilOpen,
  onVillage,
  onCouncil,
  onResearch,
}: {
  game: Game;
  raiding: boolean;
  sound: boolean;
  onSound: (on: boolean) => void;
  onGuide: () => void;
  researchSection: string | null;
  councilOpen: boolean;
  onVillage: () => void;
  onCouncil: () => void;
  onResearch: (section?: string) => void;
}) {
  const hud = hudFigures(game);
  const research = researchSection !== null;
  return (
    <>
      <header className="game-hud">
        <button
          className="player-banner"
          onClick={onGuide}
          aria-label="Open village guide"
        >
          <span className="player-crest">
            <Shield fill="#5faee3" />
            <b>{hud.hallLevel}</b>
          </span>
          <span>
            <strong>Settlement</strong>
            <small>
              {raiding ? "Expedition in progress" : "Willowmere village"}
            </small>
          </span>
        </button>
        <div className="hud-builders">
          <Hammer size={19} />
          <b>{hud.builders}</b>
          <span>Builders</span>
        </div>
        <div className="resource-hud">
          {hud.resources.map((r) => {
            const Icon = resourceIcons[r.key];
            return (
              <div
                className={`resource-pill ${r.key}`}
                key={r.key}
                aria-label={`${r.key}: ${r.amount}`}
              >
                <span className="resource-emblem">
                  <Icon />
                </span>
                <div>
                  <strong>{r.display}</strong>
                  <small>{r.label}</small>
                </div>
              </div>
            );
          })}
        </div>
        <button
          className="sound-button"
          onClick={() => onSound(!sound)}
          aria-label={sound ? "Mute game sounds" : "Enable game sounds"}
        >
          {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </header>
      {!raiding && (
        <nav
          className="settlement-navigation"
          aria-label="Settlement navigation"
        >
          <button aria-pressed={!research && !councilOpen} onClick={onVillage}>
            <Home size={16} />
            Village
          </button>
          <button aria-pressed={councilOpen} onClick={onCouncil}>
            <BookOpen size={16} />
            Council
          </button>
          <button
            aria-pressed={research && researchSection !== "library"}
            onClick={() => onResearch()}
          >
            <Shield size={16} />
            Research
          </button>
          <button
            aria-pressed={researchSection === "library"}
            onClick={() => onResearch("library")}
          >
            <Clock size={16} />
            Archive
          </button>
        </nav>
      )}
    </>
  );
}
