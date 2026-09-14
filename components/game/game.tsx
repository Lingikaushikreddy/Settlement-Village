"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Coins,
  TreePine,
  Wheat,
  Hammer,
  Swords,
  Shield,
  Trophy,
  ChevronRight,
  Check,
  Flag,
  Move,
  ArrowUp,
  BookOpen,
  Download,
  Volume2,
  VolumeX,
  Star,
  Clock,
  Lock,
  Home,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Scene, Sprite } from "./scene";
import { newGame, command, advanceGame, restoreGame } from "@/lib/game/economy";
import {
  startBattle,
  deploy,
  focusTarget,
  settleBattle,
  retreat,
} from "@/lib/game/battle";
import {
  buildings,
  troops,
  opponents,
  quests,
  upgradeCost,
  freeBuilders,
  armySize,
} from "@/lib/game/catalog";
import type {
  Game,
  BuildingKind,
  TroopKind,
  Resources,
  Command,
} from "@/lib/game/model";
import "./game.css";
const KEY = "settlement-village-game-v2";
const resourceIcons = { gold: Coins, wood: TreePine, food: Wheat };
function Cost({ cost }: { cost: Partial<Resources> }) {
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
function download(g: Game) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(
      new Blob([JSON.stringify(g, null, 2)], { type: "application/json" }),
    );
  a.href = url;
  a.download = "Settlement-village.json";
  a.click();
  URL.revokeObjectURL(url);
}
export function SettlementGame() {
  const [game, setGame] = useState<Game>(newGame),
    [ready, setReady] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [panel, setPanel] = useState<"build" | "train" | "raid" | "guide" | null>(
      null,
    ),
    [placing, setPlacing] = useState<string | null>(null),
    [notice, setNotice] = useState(""),
    [troop, setTroop] = useState<TroopKind>("knight"),
    [squad, setSquad] = useState(1),
    [saved, setSaved] = useState("Saved on this device"),
    [sound, setSound] = useState(false),
    [goalsOpen, setGoalsOpen] = useState(true);
  const current = useRef(game),
    audio = useRef<AudioContext | null>(null),
    file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    current.current = game;
  }, [game]);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const data = JSON.parse(raw),
            restored = restoreGame(JSON.stringify(data.game));
          const elapsed = Math.max(0, (Date.now() - data.savedAt) / 1000);
          setGame(advanceGame(restored, elapsed, false));
        }
      } catch {
        setNotice(
          "Your saved village could not be loaded. A new village is ready.",
        );
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const t = setInterval(() => setGame((g) => advanceGame(g, 0.2)), 200);
    return () => clearInterval(t);
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    const save = () => {
      try {
        localStorage.setItem(
          KEY,
          JSON.stringify({ game: current.current, savedAt: Date.now() }),
        );
        setSaved("Saved on this device");
      } catch {
        setSaved("Storage full · export your village");
      }
    };
    const t = setInterval(save, 2000);
    window.addEventListener("pagehide", save);
    return () => {
      clearInterval(t);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [ready]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  function chime() {
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
  }
  const update = useCallback((fn: (g: Game) => Game) => {
    try {
      const next = fn(current.current);
      current.current = next;
      setGame(next);
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "That action is unavailable.");
      return false;
    }
  }, []);
  function act(c: Command, message?: string) {
    if (update((g) => command(g, c))) {
      chime();
      if (message) setNotice(message);
      return true;
    }
    return false;
  }
  function choose(id: string) {
    if (id.startsWith("collect:")) {
      act({ type: "collect", id: id.slice(8) }, "Resources collected!");
      return;
    }
    if (game.battle) {
      update((g) => focusTarget(g, id));
      setNotice("Your troops are focusing this building.");
      return;
    }
    setSelected((s) => (s === id ? null : id));
  }
  const building = game.buildings.find((b) => b.id === selected),
    def = building ? buildings[building.kind] : null,
    battle = game.battle,
    raiding = !!battle,
    done = battle?.result;
  const unlockedQuest = quests.find((q) => !game.claimed.includes(q.id));
  const stars = battle
    ? Number(battle.buildings.find((b) => b.kind === "hall")!.hp <= 0) +
      Number(
        battle.buildings.filter((b) => b.hp <= 0).length /
          battle.buildings.length >=
          0.5,
      ) +
      Number(battle.buildings.every((b) => b.hp <= 0))
    : 0;
  function returnHome() {
    update((g) => {
      const n = settleBattle(g);
      return { ...n, battle: undefined };
    });
    setSelected(null);
    setGoalsOpen(true);
    chime();
  }
  function place(x: number, y: number) {
    if (!placing) return;
    const moving = game.buildings.find((b) => b.id === placing);
    if (
      act(
        moving
          ? { type: "move", id: placing, x, y }
          : { type: "build", kind: placing.slice(4) as BuildingKind, x, y },
        moving ? "Building moved." : "Builder on the way!",
      )
    )
      setPlacing(null);
  }
  return (
    <main className="village-game">
      <Scene
        game={game}
        selected={selected}
        placing={placing}
        onSelect={choose}
        onTile={place}
        onDeploy={(zone) => {
          if (
            update((g) =>
              deploy(g, troop, zone, Math.min(squad, g.army[troop])),
            )
          )
            chime();
        }}
      />
      <header className="game-hud">
        <button
          className="player-banner"
          onClick={() => setPanel("guide")}
          aria-label="Open village guide"
        >
          <span className="player-crest">
            <Shield fill="#5faee3" />
            <b>{game.buildings.find((b) => b.kind === "hall")?.level}</b>
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
          <b>{freeBuilders(game)}/2</b>
          <span>Builders</span>
        </div>
        <div className="resource-hud">
          {(["gold", "wood", "food"] as const).map((r) => {
            const Icon = resourceIcons[r];
            return (
              <div
                className={`resource-pill ${r}`}
                key={r}
                aria-label={`${r}: ${Math.floor(game.resources[r])}`}
              >
                <span className="resource-emblem">
                  <Icon />
                </span>
                <div>
                  <strong>
                    {Math.floor(game.resources[r]).toLocaleString("en-US")}
                  </strong>
                  <small>
                    {r === "wood" ? "Timber" : r === "food" ? "Food" : "Gold"}
                  </small>
                </div>
                <span
                  className="resource-fill"
                  style={{ width: `${Math.min(100, game.resources[r] / 30)}%` }}
                />
              </div>
            );
          })}
        </div>
        <button
          className="sound-button"
          onClick={() => setSound(!sound)}
          aria-label={sound ? "Mute game sounds" : "Enable game sounds"}
        >
          {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </header>
      {!raiding ? (
        <>
          <aside className={`quest-panel ${goalsOpen ? "" : "collapsed"}`}>
            <button
              className="quest-title"
              onClick={() => setGoalsOpen(!goalsOpen)}
            >
              <span>
                <Flag size={16} /> Your next chapter
              </span>
              <ChevronRight className={goalsOpen ? "rotate" : ""} size={16} />
            </button>
            {goalsOpen ? (
              <>
                <h1>
                  A village worth
                  <br />
                  fighting for.
                </h1>
                <p>
                  Build your home. Gather your army.
                  <br />
                  See what lies beyond the trees.
                </p>
                {quests
                  .filter((q) => !game.claimed.includes(q.id))
                  .slice(0, 2)
                  .map((q) => {
                    const progress = Math.min(q.goal, game.stats[q.stat]),
                      complete = progress >= q.goal;
                    return (
                      <button
                        className={`quest-item ${complete ? "complete" : ""}`}
                        key={q.id}
                        onClick={() => {
                          if (complete)
                            act(
                              { type: "claim", id: q.id },
                              `Quest complete! +${q.reward} gold`,
                            );
                          else if (q.id === "build") setPanel("build");
                          else if (q.id === "raid") setPanel("raid");
                          else if (q.id === "upgrade") setSelected("hall");
                          else
                            setNotice(
                              "Tap the resource bubbles above your mine, mill and farm.",
                            );
                        }}
                      >
                        <span className="quest-check">
                          {complete ? <Check size={15} /> : <Flag size={13} />}
                        </span>
                        <span>
                          <b>{q.name}</b>
                          <small>
                            {complete ? `Claim ${q.reward} gold` : q.detail}
                          </small>
                          <i>
                            <em
                              style={{ width: `${(progress / q.goal) * 100}%` }}
                            />
                          </i>
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    );
                  })}
                {!unlockedQuest ? (
                  <div className="all-quests">
                    <Trophy />
                    All village goals complete!
                  </div>
                ) : null}
              </>
            ) : null}
          </aside>
          <div className="village-badge">
            <Trophy size={17} />
            <strong>{game.trophies}</strong>
            <span>Explorer league</span>
          </div>
          {placing ? (
            <div className="placement-notice">
              <Hammer size={20} />
              <div>
                <b>
                  {game.buildings.some((b) => b.id === placing)
                    ? "Choose a new location"
                    : `Place your ${buildings[placing.slice(4) as BuildingKind].name.toLowerCase()}`}
                </b>
                <span>Tap an empty diamond. Drag the map to explore.</span>
              </div>
              <button
                onClick={() => setPlacing(null)}
                aria-label="Cancel placement"
              >
                <X />
              </button>
            </div>
          ) : null}
          {building && def && !placing ? (
            <section className="building-panel">
              <button
                className="panel-close"
                onClick={() => setSelected(null)}
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
                <p>
                  {building.readyAt
                    ? `Ready in ${Math.ceil(building.readyAt - game.clock)} seconds`
                    : def.resource
                      ? `${def.rate * building.level} ${def.resource} / second · ${Math.floor(building.stored)} / ${def.capacity * building.level} stored`
                      : def.description}
                </p>
              </div>
              <div className="building-actions">
                {def.resource ? (
                  <button
                    className="game-button gold small"
                    onClick={() =>
                      act(
                        { type: "collect", id: building.id },
                        "Resources collected!",
                      )
                    }
                    disabled={building.stored < 1}
                  >
                    Collect{" "}
                    <Cost
                      cost={{ [def.resource]: Math.floor(building.stored) }}
                    />
                  </button>
                ) : building.kind === "barracks" ? (
                  <button
                    className="game-button blue small"
                    onClick={() => setPanel("train")}
                  >
                    Train troops
                  </button>
                ) : null}
                <button
                  className="game-button green small"
                  disabled={!!building.readyAt || building.level >= 5}
                  onClick={() =>
                    act(
                      { type: "upgrade", id: building.id },
                      "Upgrade started!",
                    )
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
                  onClick={() => setPlacing(building.id)}
                >
                  <Move size={20} />
                </button>
              </div>
            </section>
          ) : null}
          <footer className="game-bottom">
            <div className="army-dock">
              <button
                className="army-heading"
                onClick={() => setPanel("train")}
              >
                <Shield size={16} />
                <span>
                  Your army{" "}
                  <b>
                    {Object.values(game.army).reduce((a, b) => a + b, 0)}/40
                  </b>
                </span>
                <ChevronRight size={16} />
              </button>
              <div className="army-cards">
                {(Object.keys(troops) as TroopKind[]).map((k) => (
                  <button
                    className="army-card"
                    key={k}
                    onClick={() => setPanel("train")}
                    aria-label={`Train ${troops[k].name}, ${game.army[k]} ready`}
                  >
                    <Sprite index={troops[k].sprite} />
                    <span className="troop-count">{game.army[k]}</span>
                    <small>{troops[k].name}</small>
                  </button>
                ))}
                <button
                  className="train-more"
                  onClick={() => setPanel("train")}
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
                  setPanel("build");
                  setSelected(null);
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
                  setPanel("raid");
                  setSelected(null);
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
      ) : (
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
                {Math.floor(
                  (battle.buildings.filter((b) => b.hp <= 0).length /
                    battle.buildings.length) *
                    100,
                )}
                % destroyed
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
                      onClick={() =>
                        update((g) =>
                          deploy(
                            g,
                            troop,
                            zone,
                            Math.min(squad, g.army[troop]),
                          ),
                        )
                      }
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
                      onClick={() => setTroop(k)}
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
                  onClick={() => setSquad(squad === 1 ? 5 : 1)}
                >
                  Deploy <b>{squad}</b> at a time
                </button>
              </div>
            </>
          ) : null}
        </>
      )}
      {!raiding ? (
        <div className="save-status">
          <span />
          {saved}
          <button
            aria-label="Export village save"
            onClick={() => download(game)}
          >
            <Download size={12} />
          </button>
        </div>
      ) : null}
      {notice ? (
        <div className="game-toast" role="status">
          <Check size={18} />
          {notice}
          <button onClick={() => setNotice("")} aria-label="Dismiss message">
            <X size={16} />
          </button>
        </div>
      ) : null}
      {panel !== null ? (
        <Dialog open onOpenChange={(v) => !v && setPanel(null)}>
          <DialogContent className="game-dialog">
            <DialogTitle className="game-dialog-title">
              {panel === "build"
                ? "Make room for possibility."
                : panel === "train"
                  ? "Your army starts here."
                  : panel === "raid"
                    ? "Beyond the treeline."
                    : "Welcome home, chief."}
            </DialogTitle>
            <DialogDescription>
              {panel === "build"
                ? `${freeBuilders(game)} of 2 builders available. Choose a building, then place it in your village.`
                : panel === "train"
                  ? `${armySize(game)} / 40 camp spaces used. Training continues while you explore.`
                  : panel === "raid"
                    ? "Scout a stronghold, deploy your troops, and bring the spoils home."
                    : "Build a thriving village and lead your troops into battle."}
            </DialogDescription>
            {panel === "build" ? (
              <div className="build-shop">
                {(Object.keys(buildings) as BuildingKind[])
                  .filter((k) => k !== "hall")
                  .map((k) => (
                    <button
                      className="shop-item"
                      key={k}
                      disabled={freeBuilders(game) < 1}
                      onClick={() => {
                        setPlacing(`new:${k}`);
                        setPanel(null);
                        setSelected(null);
                      }}
                    >
                      <Sprite index={buildings[k].sprite} />
                      <h3>{buildings[k].name}</h3>
                      <span>
                        <Clock size={12} />
                        {buildings[k].seconds}s to build
                      </span>
                      <Cost cost={buildings[k].cost} />
                      <b className="shop-cta">
                        Place building <ChevronRight size={13} />
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
                        onClick={() =>
                          act(
                            { type: "train", kind: k, count: 5 },
                            `Five ${troops[k].name.toLowerCase()}s queued.`,
                          )
                        }
                      >
                        Queue 5
                      </button>
                    </article>
                  ))}
                </div>
                <div className="training-queue">
                  <Hammer size={18} />
                  {game.training.length ? (
                    <>
                      <b>{game.training.length} training</b>
                      <span>
                        Next {troops[game.training[0].kind].name.toLowerCase()}{" "}
                        in{" "}
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
                      disabled={i > game.unlocked}
                      onClick={() => {
                        if (update((g) => startBattle(g, i))) {
                          setPanel(null);
                          setSelected(null);
                          setGoalsOpen(false);
                        }
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
                  Deployed troops are spent. Troops left in reserve return home.
                  Earn a star to unlock the next stronghold.
                </p>
              </div>
            ) : null}
            {panel === "guide" ? (
              <div className="game-guide">
                <div>
                  <Hammer />
                  <p>
                    <b>Build your village</b>Collect from the floating resource
                    bubbles. Place and upgrade buildings to grow production.
                  </p>
                </div>
                <div>
                  <Shield />
                  <p>
                    <b>Train your army</b>Knights absorb damage. Archers strike
                    from range. Catapults break through strong defenses.
                  </p>
                </div>
                <div>
                  <Swords />
                  <p>
                    <b>Lead the raid</b>Deploy along the edges and focus towers
                    first. Destroy the town hall, half the village, and every
                    building for three stars.
                  </p>
                </div>
                <p className="guide-limit">
                  Single-player campaign. Progress saves on this device; offline
                  production is capped at 8 hours. No purchases or paid AI.
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
                  <a href="/lab">Open simulation lab</a>
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
                      const imported = restoreGame(await f.text());
                      current.current = imported;
                      setGame(imported);
                      setPanel(null);
                      setNotice("Village restored from your save.");
                    } catch (error) {
                      setNotice(
                        error instanceof Error
                          ? error.message
                          : "Cannot read save.",
                      );
                    }
                    e.target.value = "";
                  }}
                />
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
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
            <button className="game-button gold" onClick={returnHome}>
              <Home size={20} />
              Return to village
            </button>
          </DialogContent>
        </Dialog>
      ) : null}
    </main>
  );
}
