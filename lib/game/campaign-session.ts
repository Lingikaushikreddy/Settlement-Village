import { advanceGame, newGame, restoreGame } from "./economy.ts";
import type { Game } from "./model.ts";

export const CAMPAIGN_SAVE_KEY = "settlement-village-game-v2";
export type CampaignSessionState =
  | "checking"
  | "active"
  | "blocked"
  | "unsupported"
  | "unavailable"
  | "recovery"
  | "closed";

type LockAdapter = {
  request(
    name: string,
    options: { mode: "exclusive"; ifAvailable: true },
    callback: (lock: unknown | null) => Promise<void> | void,
  ): Promise<unknown>;
};
type SessionOptions = {
  locks?: LockAdapter;
  storage: Pick<Storage, "getItem" | "setItem">;
  now?: () => number;
  onChange?: (session: CampaignSession) => void;
};

/** One mounted campaign owns one same-origin Web Lock for its whole lifetime. */
export class CampaignSession {
  state: CampaignSessionState = "checking";
  game: Game | null = null;
  rawSave: string | null = null;
  private options: SessionOptions;
  private started = false;
  private ownsLock = false;
  private closed = false;
  private release: (() => void) | null = null;
  private shutdown: (() => void) | null = null;

  constructor(options: SessionOptions) {
    this.options = options;
  }

  private publish(state: CampaignSessionState) {
    this.state = state;
    this.options.onChange?.(this);
  }

  get active() {
    return this.ownsLock && !this.closed && this.state === "active";
  }

  start() {
    if (this.started || this.closed) return;
    this.started = true;
    if (!this.options.locks) {
      try {
        this.rawSave = this.options.storage.getItem(CAMPAIGN_SAVE_KEY);
      } catch {
        // A browser without locks must never fall back to a writable session.
      }
      this.publish("unsupported");
      return;
    }
    try {
      void this.options.locks
        .request(
          CAMPAIGN_SAVE_KEY,
          { mode: "exclusive", ifAvailable: true },
          (lock) => {
            // React may have abandoned this effect before the browser grants it.
            if (this.closed) return;
            if (!lock) {
              this.publish("blocked");
              return;
            }
            this.ownsLock = true;
            const held = new Promise<void>((resolve) => {
              this.release = resolve;
            });
            this.load();
            return held;
          },
        )
        .catch(() => {
          if (!this.closed) this.publish("unavailable");
        });
    } catch {
      this.publish("unavailable");
    }
  }

  private load() {
    try {
      this.rawSave = this.options.storage.getItem(CAMPAIGN_SAVE_KEY);
    } catch {
      this.publish("unavailable");
      return;
    }
    try {
      if (this.rawSave !== null) {
        const data = JSON.parse(this.rawSave);
        if (
          !data ||
          typeof data.savedAt !== "number" ||
          !Number.isFinite(data.savedAt) ||
          data.savedAt < 0
        )
          throw Error("Invalid save timestamp.");
        const game = restoreGame(JSON.stringify(data.game));
        this.game = advanceGame(
          game,
          Math.max(0, ((this.options.now ?? Date.now)() - data.savedAt) / 1000),
          false,
        );
      } else {
        this.game = newGame();
      }
      this.publish("active");
    } catch {
      // Keep the exact original bytes; mounting a new game here would erase them.
      this.publish("recovery");
    }
  }

  save(game: Game) {
    if (!this.active) return false;
    this.write(game);
    return true;
  }

  private write(game: Game) {
    this.options.storage.setItem(
      CAMPAIGN_SAVE_KEY,
      JSON.stringify({ game, savedAt: (this.options.now ?? Date.now)() }),
    );
  }

  replaceDamagedSave() {
    if (!this.ownsLock || this.closed || this.state !== "recovery")
      return false;
    const game = newGame();
    // A failed write leaves both the recovery screen and original bytes intact.
    this.write(game);
    this.game = game;
    this.publish("active");
    return true;
  }

  registerShutdown(shutdown: () => void) {
    if (!this.active) return () => {};
    this.shutdown = shutdown;
    return () => {
      if (this.shutdown === shutdown) this.shutdown = null;
    };
  }

  close() {
    if (this.closed) return;
    try {
      // The child stops timers and flushes synchronously while save() is allowed.
      this.shutdown?.();
    } finally {
      this.shutdown = null;
      this.closed = true;
      this.ownsLock = false;
      this.release?.();
      this.release = null;
      this.publish("closed");
    }
  }
}
