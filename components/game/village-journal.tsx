"use client";
import { useRef, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronRight,
  Coins,
  Hammer,
  Leaf,
  Shield,
  TreePine,
  Trophy,
  Wheat,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildings, quests } from "@/lib/game/catalog";
import type { Game } from "@/lib/game/model";
import { crewRoster } from "@/lib/game/crew";
import { ResidentAvatar } from "./resident-avatar";
import "./village-journal.css";

export function VillageJournal({
  game,
  onQuest,
  onResident,
  onGuide,
}: {
  game: Game;
  onQuest: (id: string) => void;
  onResident: (id: string) => void;
  onGuide: () => void;
}) {
  const [open, setOpen] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const openingAnotherView = useRef(false);
  const ready = quests.filter(
    (q) => !game.claimed.includes(q.id) && game.stats[q.stat] >= q.goal,
  ).length;
  const collected = quests.filter((q) => game.claimed.includes(q.id)).length;
  const production = Object.entries(buildings)
    .filter(([, b]) => b.resource)
    .map(([kind, def]) => ({
      kind,
      def,
      rate: game.buildings
        .filter((b) => b.kind === kind && !b.readyAt)
        .reduce((n, b) => n + def.rate * b.level, 0),
      stored: game.buildings
        .filter((b) => b.kind === kind)
        .reduce((n, b) => n + Math.floor(b.stored), 0),
    }));
  return (
    <>
      <button
        ref={launcher}
        className="journal-launcher"
        onClick={() => {
          openingAnotherView.current = false;
          setOpen(true);
        }}
        aria-label={`Open village journal${ready ? `, ${ready} rewards ready` : ""}`}
      >
        <BookOpen size={20} />
        <span>
          <b>Village journal</b>
          <small>
            {ready
              ? `${ready} ${ready === 1 ? "reward" : "rewards"} ready`
              : `${collected} of ${quests.length} milestones claimed`}
          </small>
        </span>
        {ready > 0 ? <i>{ready}</i> : <ChevronRight size={16} />}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="journal-dialog"
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!openingAnotherView.current) launcher.current?.focus();
          }}
        >
          <div
            className="journal-vista"
            role="img"
            aria-label="Illustration of Willowmere in its forest valley"
          />
          <button
            className="journal-close"
            onClick={() => setOpen(false)}
            aria-label="Close village journal"
          >
            <X size={20} />
          </button>
          <header className="journal-heading">
            <div>
              <DialogTitle>Your village, taking shape.</DialogTitle>
              <DialogDescription>
                Willowmere grows through the work you share.
              </DialogDescription>
            </div>
            <span>
              <Trophy size={18} />
              {game.trophies} trophies
            </span>
          </header>
          <div className="journal-content">
            <section aria-label="Village milestones">
              <h3>
                <BookOpen size={18} /> The next chapter
              </h3>
              <p>Milestones reward real progress. Claim each reward once.</p>
              <div className="journal-milestones">
                {quests.map((q) => {
                  const claimed = game.claimed.includes(q.id),
                    progress = Math.min(q.goal, game.stats[q.stat]),
                    complete = progress >= q.goal;
                  return (
                    <button
                      key={q.id}
                      disabled={claimed}
                      className={complete ? "milestone complete" : "milestone"}
                      onClick={() => {
                        openingAnotherView.current = !complete;
                        onQuest(q.id);
                        if (!complete) setOpen(false);
                      }}
                    >
                      <span className="milestone-icon">
                        {claimed ? (
                          <Check size={20} />
                        ) : q.id === "build" ? (
                          <Hammer size={20} />
                        ) : q.id === "raid" ? (
                          <Shield size={20} />
                        ) : (
                          <Leaf size={20} />
                        )}
                      </span>
                      <span>
                        <b>{q.name}</b>
                        <small>
                          {claimed
                            ? "Reward claimed"
                            : complete
                              ? `Claim ${q.reward} gold`
                              : q.detail}
                        </small>
                        <progress
                          value={progress}
                          max={q.goal}
                          aria-label={`${q.name} progress`}
                        />
                      </span>
                      <span className="milestone-reward">
                        {claimed ? (
                          <Check size={18} />
                        ) : (
                          <>
                            <Coins size={15} />
                            {q.reward}
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
            <section aria-label="Village production">
              <h3>
                <Leaf size={18} /> Working land
              </h3>
              <p>
                Production fills building stores. Collect it to fund your plans.
              </p>
              <div className="journal-production">
                {production.map(({ kind, def, rate, stored }) => {
                  const Icon =
                    def.resource === "gold"
                      ? Coins
                      : def.resource === "wood"
                        ? TreePine
                        : Wheat;
                  return (
                    <div key={kind}>
                      <Icon size={21} />
                      <strong>
                        {rate}
                        <small> / sec</small>
                      </strong>
                      <b>
                        {def.resource === "wood"
                          ? "Timber"
                          : def.resource === "food"
                            ? "Food"
                            : "Gold"}
                      </b>
                      <span>{stored} ready to collect</span>
                    </div>
                  );
                })}
              </div>
            </section>
            <section aria-label="Meet your residents">
              <h3>Six residents. A shared purpose.</h3>
              <div className="journal-residents">
                {crewRoster.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setOpen(false);
                      openingAnotherView.current = true;
                      onResident(r.id);
                    }}
                  >
                    <ResidentAvatar id={r.id} size={60} />
                    <b>{r.name}</b>
                    <small>{r.role}</small>
                  </button>
                ))}
              </div>
            </section>
            <footer>
              <p>
                New to Willowmere? Learn how objectives, construction and
                expeditions fit together.
              </p>
              <button
                onClick={() => {
                  setOpen(false);
                  openingAnotherView.current = true;
                  onGuide();
                }}
              >
                Open the field guide <ChevronRight size={16} />
              </button>
            </footer>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
