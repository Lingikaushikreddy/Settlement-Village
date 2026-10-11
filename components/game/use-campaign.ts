"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CampaignSession } from "@/lib/game/campaign-session";
import { advanceGame, command } from "@/lib/game/economy";
import { crewCommand } from "@/lib/game/crew";
import type { CrewCommand } from "@/lib/game/crew-types";
import type { Command, Game } from "@/lib/game/model";

export type Campaign = {
  game: Game;
  /** Applies fn to the latest game, saves, returns false (and sets a notice) when the command throws. */
  update: (fn: (g: Game) => Game) => boolean;
  /** update(command(g, c)); on success plays the chime and shows message. */
  act: (c: Command, message?: string) => boolean;
  /** update(crewCommand(g, c)); UI side effects stay with the caller. */
  crewAct: (c: CrewCommand) => boolean;
  /** The game as of the last update or tick, for handlers that must not read stale render state. */
  latest: () => Game;
  notice: string;
  setNotice: (text: string) => void;
  saved: string;
  sound: boolean;
  setSound: (on: boolean) => void;
  chime: () => void;
};

const SAVED = "Saved on this device";
const SAVE_FAILED = "Cannot save on this device · export your village";

/** Owns the campaign's game state, its 200 ms clock, autosave and the command path. */
export function useCampaign(
  session: CampaignSession,
  initialGame: Game,
): Campaign {
  const [game, setGame] = useState<Game>(initialGame);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(SAVED);
  const [sound, setSound] = useState(false);
  const current = useRef(game);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    let stopped = false;
    const save = () => {
      if (!session.active) return;
      try {
        session.save(current.current);
        setSaved(SAVED);
      } catch {
        setSaved(SAVE_FAILED);
      }
    };
    const advance = setInterval(() => {
      if (stopped || !session.active) return;
      const next = advanceGame(current.current, 0.2);
      current.current = next;
      setGame(next);
    }, 200);
    const autosave = setInterval(save, 2000);
    const hide = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", hide);
    const shutdown = () => {
      if (stopped) return;
      stopped = true;
      clearInterval(advance);
      clearInterval(autosave);
      document.removeEventListener("visibilitychange", hide);
      save();
    };
    const unregister = session.registerShutdown(shutdown);
    return () => {
      shutdown();
      unregister();
    };
  }, [session]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  const chime = useCallback(() => {
    if (!sound) return;
    try {
      audio.current ??= new AudioContext();
      const ctx = audio.current;
      void ctx.resume();
      [523, 659, 784].forEach((frequency, i) => {
        const o = ctx.createOscillator(),
          v = ctx.createGain();
        o.type = "sine";
        o.frequency.value = frequency;
        v.gain.setValueAtTime(0.045, ctx.currentTime + i * 0.06);
        v.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + 0.2 + i * 0.06,
        );
        o.connect(v);
        v.connect(ctx.destination);
        o.start(ctx.currentTime + i * 0.06);
        o.stop(ctx.currentTime + 0.25 + i * 0.06);
      });
    } catch {}
  }, [sound]);

  const update = useCallback(
    (fn: (g: Game) => Game) => {
      if (!session.active) return false;
      try {
        const next = fn(current.current);
        current.current = next;
        setGame(next);
        // Browsers may terminate a tab without pagehide. Persist player actions
        // before returning, rather than relying on the next autosave or close.
        try {
          session.save(next);
          setSaved(SAVED);
        } catch {
          setSaved(SAVE_FAILED);
        }
        return true;
      } catch (e) {
        setNotice(
          e instanceof Error ? e.message : "That action is unavailable.",
        );
        return false;
      }
    },
    [session],
  );

  const act = useCallback(
    (c: Command, message?: string) => {
      if (!update((g) => command(g, c))) return false;
      chime();
      if (message) setNotice(message);
      return true;
    },
    [update, chime],
  );

  const crewAct = useCallback(
    (c: CrewCommand) => update((g) => crewCommand(g, c)),
    [update],
  );
  const latest = useCallback(() => current.current, []);

  return {
    game,
    update,
    act,
    crewAct,
    latest,
    notice,
    setNotice,
    saved,
    sound,
    setSound,
    chime,
  };
}
