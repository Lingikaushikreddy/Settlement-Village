"use client";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Hammer,
  Trophy,
  Check,
  Flag,
  Move,
  ArrowUp,
  Download,
  Star,
  Clock,
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
import {
  CampaignSession,
  type CampaignSessionState,
} from "@/lib/game/campaign-session";
import {
  deploy,
  focusTarget,
  settleBattle,
  retreat,
} from "@/lib/game/battle";
import {
  buildings,
  troops,
  opponents,
  upgradeCost,
} from "@/lib/game/catalog";
import type {
  Game,
  BuildingKind,
  TroopKind,
} from "@/lib/game/model";
import { CrewInspector } from "./crew";
import { actionProblem } from "@/lib/game/action-availability";
import { crewCommand, crewRoster } from "@/lib/game/crew";
import type { CrewCommand } from "@/lib/game/crew-types";
import { CouncilPanel } from "./council";
import { useCampaign } from "./use-campaign";
import { SessionGate } from "./session-gate";
import { CampaignHud } from "./campaign-hud";
import { CampaignFooter } from "./campaign-footer";
import {
  CampaignDialogs,
  Cost,
  download,
  type Panel,
} from "./campaign-dialogs";
import {
  activeIncidentTargets,
  battleStars,
  buildingSummary,
  destructionPercent,
  displayedResearch,
  placementTitle,
  researchCaption,
  sceneResidents,
} from "./campaign-view-model";
import {
  councilCommand,
  councilResearchRun,
  newCouncil,
} from "@/lib/game/council";
import type { Run } from "@/lib/sim/types";
import type { ResearchFrame } from "../observatory";
import "./game.css";
import "./research.css";
import "./session.css";
import "./polish.css";
const Research = lazy(() =>
  import("../observatory").then((m) => ({ default: m.Observatory })),
);
export function SettlementGame() {
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<{
    session: CampaignSession;
    state: CampaignSessionState;
    attempt: number;
  } | null>(null);

  useEffect(() => {
    let disposed = false;
    const session = new CampaignSession({
      locks: navigator.locks,
      storage: {
        getItem: (key) => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value),
      },
      onChange: (current) => {
        if (!disposed)
          setView({ session: current, state: current.state, attempt });
      },
    });
    session.start();
    const leave = () => session.close();
    const returnToPage = () => {
      // A page restored from the back-forward cache must obtain a fresh lock
      // and read the latest save before mounting its campaign again.
      if (session.state === "closed") setAttempt((value) => value + 1);
    };
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", returnToPage);
    return () => {
      disposed = true;
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", returnToPage);
      session.close();
    };
  }, [attempt]);

  if (view?.state === "active" && view.session.active && view.session.game) {
    return (
      <CampaignGame
        key={view.attempt}
        session={view.session}
        initialGame={view.session.game}
      />
    );
  }
  return (
    <SessionGate
      state={view?.state ?? "checking"}
      session={view?.session ?? null}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}
function CampaignGame({
  session,
  initialGame,
}: {
  session: CampaignSession;
  initialGame: Game;
}) {
  const {
    game,
    update,
    act,
    crewAct: campaignCrewAct,
    latest,
    notice,
    setNotice,
    saved,
    sound,
    setSound,
    chime,
  } = useCampaign(session, initialGame);
  const [selected, setSelected] = useState<string | null>(null),
    [panel, setPanel] = useState<Panel | null>(null),
    [councilOpen, setCouncilOpen] = useState(false),
    [crewOpen, setCrewOpen] = useState(false),
    [crewView, setCrewView] = useState<"agent" | "jobs" | "history">("agent"),
    [resident, setResident] = useState("mira"),
    [research, setResearch] = useState<{ run: Run; section: string } | null>(
      null,
    ),
    [researchFrame, setResearchFrame] = useState<ResearchFrame | null>(null),
    [placing, setPlacing] = useState<string | null>(null),
    [troop, setTroop] = useState<TroopKind>("knight"),
    [squad, setSquad] = useState(1);
  const crewTrigger = useRef<HTMLElement | null>(null);
  const crewAct = (c: CrewCommand) => {
    if (campaignCrewAct(c) && c.type === "start") {
      setCouncilOpen(false);
      setSelected(null);
      setPlacing(null);
      setNotice("Objective set. Your residents are choosing their jobs.");
    }
    return true;
  };
  function openCrew(id?: string) {
    crewTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (id) setResident(id);
    setCrewView(id ? "agent" : "jobs");
    setSelected(null);
    setCrewOpen(true);
  }
  function openCouncil(id?: string) {
    setCrewOpen(false);
    setResearch(null);
    setResearchFrame(null);
    if (id) setResident(id);
    update((g) =>
      councilCommand(g.crew ? crewCommand(g, { type: "pause" }) : g, {
        type: "pause",
      }),
    );
    setSelected(null);
    setCouncilOpen(true);
  }
  const openResearch = useCallback(
    (section = "observatory") => {
      if (latest().battle) return;
      update((g) =>
        councilCommand(g.crew ? crewCommand(g, { type: "pause" }) : g, {
          type: "pause",
        }),
      );
      setResearch((r) =>
        r
          ? { ...r, section }
          : {
              run: councilResearchRun(latest().council ?? newCouncil()),
              section,
            },
      );
      setCouncilOpen(false);
      setCrewOpen(false);
      setPanel(null);
      setSelected(null);
      setPlacing(null);
    },
    [update, latest],
  );
  const researchSection = useCallback(
    (section: string) => setResearch((r) => r && { ...r, section }),
    [],
  );
  function closeResearch() {
    setResearch(null);
    setResearchFrame(null);
  }
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (
      q.has("seed") ||
      q.has("report") ||
      ["research", "archive"].includes(q.get("view") ?? "")
    ) {
      const timer = setTimeout(
        () =>
          openResearch(
            q.get("view") === "archive"
              ? "library"
              : q.has("report")
                ? "experiments"
                : "observatory",
          ),
        0,
      );
      return () => clearTimeout(timer);
    }
  }, [openResearch]);
  function choose(id: string) {
    if (research) return;
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
  const upgradeProblem = building
    ? actionProblem(game, { type: "upgrade", id: building.id })
    : null;
  const stars = battle ? battleStars(battle) : 0;
  function returnHome() {
    update((g) => {
      const n = settleBattle(g);
      return { ...n, battle: undefined };
    });
    setSelected(null);
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
  const displayed = displayedResearch(researchFrame, research, game);
  return (
    <main
      className={`village-game ${research ? "research-active" : ""} ${placing ? "placing-active" : ""} ${raiding ? "raiding-active" : ""}`}
    >
      {crewOpen && !game.battle && !research && (
        <CrewInspector
          initialView={crewView}
          onReturnFocus={() => {
            if (crewTrigger.current?.isConnected) crewTrigger.current.focus();
            else
              document
                .querySelector<HTMLButtonElement>(".crew-board-heading")
                ?.focus();
          }}
          game={game}
          selected={resident}
          onSelected={setResident}
          onCommand={crewAct}
          onClose={() => setCrewOpen(false)}
        />
      )}
      {councilOpen && !game.battle && (
        <CouncilPanel
          key={game.council?.chapter ?? 0}
          game={game}
          resident={resident}
          onResident={setResident}
          onAction={(c) => update((g) => councilCommand(g, c))}
          onClose={() => setCouncilOpen(false)}
        />
      )}
      <Scene
        game={game}
        selected={selected}
        placing={placing}
        residents={sceneResidents(
          displayed.run,
          displayed.tick,
          game,
          !research && !councilOpen,
        )}
        crewAgents={
          !research && !councilOpen && game.crew?.objective
            ? game.crew.agents
            : undefined
        }
        activeIncidents={activeIncidentTargets(displayed.run, displayed.tick)}
        selectedResident={councilOpen || crewOpen || research ? resident : null}
        onResident={
          research
            ? setResident
            : (id) =>
                game.crew?.objective && crewRoster.some((r) => r.id === id)
                  ? openCrew(id)
                  : openCouncil(id)
        }
        readOnly={!!research}
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
      <CampaignHud
        game={game}
        raiding={raiding}
        sound={sound}
        onSound={setSound}
        onGuide={() => setPanel("guide")}
        researchSection={research?.section ?? null}
        councilOpen={councilOpen}
        onVillage={() => {
          closeResearch();
          setCouncilOpen(false);
        }}
        onCouncil={() => openCouncil()}
        onResearch={openResearch}
      />
      {research && (
        <>
          <div className="research-map-caption">
            <strong>{displayed.run.name}</strong>
            <span>
              Tick {displayed.tick} · {researchCaption(researchFrame?.mode)}
            </span>
            <p>Select a resident on the map to follow their decisions.</p>
          </div>
          <aside
            className="unified-workbench"
            aria-label="Village research desk"
          >
            <Suspense
              fallback={
                <p className="research-loading">Opening the village records…</p>
              }
            >
              <Research
                currentRun={research.run}
                section={research.section}
                onSection={researchSection}
                selectedResident={resident}
                onSelected={setResident}
                onFrame={setResearchFrame}
                onExit={closeResearch}
              />
            </Suspense>
          </aside>
        </>
      )}
      {!raiding ? (
        !research && (
          <>
            <CampaignFooter
              game={game}
              act={act}
              crewAct={crewAct}
              onInspect={openCrew}
              onCouncil={() => openCouncil()}
              onPanel={setPanel}
              onSelect={setSelected}
              onNotice={setNotice}
            />
            {placing ? (
              <div className="placement-notice">
                <Hammer size={20} />
                <div>
                  <b>{placementTitle(game, placing)}</b>
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
                  <p>{buildingSummary(game, building)}</p>
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
                    disabled={!!upgradeProblem}
                    aria-describedby={
                      upgradeProblem ? "upgrade-problem" : undefined
                    }
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
                {upgradeProblem && (
                  <p
                    id="upgrade-problem"
                    className="action-problem building-problem"
                  >
                    {upgradeProblem}
                  </p>
                )}
              </section>
            ) : null}
          </>
        )
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
      {!raiding && !research ? (
        <div className="save-status" role="status">
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
      <CampaignDialogs
        panel={panel}
        game={game}
        act={act}
        update={update}
        onClose={() => setPanel(null)}
        onPlace={(kind) => {
          setPlacing(`new:${kind}`);
          setPanel(null);
          setSelected(null);
        }}
        onScouted={() => {
          setPanel(null);
          setSelected(null);
        }}
        guide={{
          game,
          onResearch: () => openResearch(),
          onError: setNotice,
          onImport: (imported) => {
            if (!update(() => imported)) return;
            closeResearch();
            setCouncilOpen(false);
            setCrewOpen(false);
            setSelected(null);
            setPlacing(null);
            setPanel(null);
            setNotice("Village restored from your save.");
          },
        }}
      />
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
