"use client";
import { useRef } from "react";
import { BookOpen, Download, Hammer, Shield, Swords } from "lucide-react";
import { restoreGame } from "@/lib/game/economy";
import type { Game } from "@/lib/game/model";
import { download } from "./campaign-shared";

export type GuideProps = {
  game: Game;
  onImport: (imported: Game) => void;
  onError: (message: string) => void;
  onResearch: () => void;
};

/** The player guide: how to play, plus export, import and the research shortcut. */
export function Guide({ game, onImport, onError, onResearch }: GuideProps) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="game-guide">
      <div
        className="guide-vista"
        role="img"
        aria-label="Illustration of Willowmere in its forest valley"
      />
      <div>
        <Hammer />
        <p>
          <b>Build your village</b>Collect from the floating resource bubbles.
          Place and upgrade buildings to grow production.
        </p>
      </div>
      <div>
        <Shield />
        <p>
          <b>Train your army</b>Kavyas absorb damage. Jhansis strike from range.
          Catapults break through strong defenses.
        </p>
      </div>
      <div>
        <Swords />
        <p>
          <b>Lead the raid</b>Deploy along the edges and focus towers first.
          Destroy the town hall, half the village, and every building for three
          stars.
        </p>
      </div>
      <div>
        <BookOpen />
        <p>
          <b>Give your crew an objective</b>Choose Grow the village, Prepare for
          a raid or Restock supplies in Village orders. Residents collect actual
          resources, build and upgrade a new farm, organize recruitment, and
          replan around shortages. Review the growth plan’s spending ceiling and
          protected reserves before starting. Inspect a resident to see their
          job and memories. Crew work pauses during raids, offline, in Council
          and in Research.
        </p>
      </div>
      <div>
        <BookOpen />
        <p>
          <b>Care for your residents</b>Open Council stories to meet six
          residents. Start their day, inspect rumors, and give evidence before
          they decide. Work earns supplies; deception can cost gold. Social
          stories pause during raids and while offline.
        </p>
      </div>
      <p className="guide-limit">
        Single-player campaign. Progress saves on this device; offline
        production is capped at 8 hours. Free resident policies are the default.
        Optional model decisions are configured in Research.
      </p>
      <div className="guide-links">
        <button onClick={() => download(game)}>
          <Download size={16} />
          Export save
        </button>
        <button onClick={() => file.current?.click()}>
          <BookOpen size={16} />
          Import save
        </button>
        <button onClick={onResearch}>Open village research</button>
      </div>
      <input
        type="file"
        ref={file}
        hidden
        accept="application/json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            if (f.size > 2000000)
              throw Error("Choose a save smaller than 2 MB.");
            onImport(restoreGame(await f.text()));
          } catch (error) {
            onError(
              error instanceof Error ? error.message : "Cannot read save.",
            );
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
