"use client";
import { useCallback, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { Scene } from "./scene";
import type { CampaignSession } from "@/lib/game/campaign-session";
import { deploy, focusTarget, settleBattle } from "@/lib/game/battle";
import type { Game, BuildingKind, TroopKind } from "@/lib/game/model";
import { CrewInspector } from "./crew";
import { crewCommand, crewRoster } from "@/lib/game/crew";
import type { CrewCommand } from "@/lib/game/crew-types";
import { CouncilPanel } from "./council";
import { councilCommand } from "@/lib/game/council";
import { useCampaign } from "./use-campaign";
import { SessionGate, useCampaignSession } from "./session-gate";
import { SelectionPanel } from "./selection-panel";
import { BattleOverlay } from "./battle-overlay";
import { CampaignHud } from "./campaign-hud";
import { CampaignFooter } from "./campaign-footer";
import { CampaignDialogs, type Panel } from "./campaign-dialogs";
import { ResearchOverlay, useResearchDesk } from "./research-overlay";
import { activeIncidentTargets, sceneResidents } from "./campaign-view-model";
import "./game.css";
import "./research.css";
import "./session.css";
import "./polish.css";

/** Mounts the campaign once its session (save lock and saved game) is ready; otherwise the gate explains why not. */
export function SettlementGame() {
  const { view, retry } = useCampaignSession();
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
      onRetry={retry}
    />
  );
}

/** The campaign composer: shared UI state and the layout of the regions. Game state lives in useCampaign. */
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
    [placing, setPlacing] = useState<string | null>(null),
    [troop, setTroop] = useState<TroopKind>("knight"),
    [squad, setSquad] = useState(1);
  const crewTrigger = useRef<HTMLElement | null>(null);
  // Closes every village panel. The research desk calls it when it opens, so it must stay stable.
  const closeVillagePanels = useCallback(() => {
    setCouncilOpen(false);
    setCrewOpen(false);
    setPanel(null);
    setSelected(null);
    setPlacing(null);
  }, []);
  const desk = useResearchDesk({ game, update, latest }, closeVillagePanels);
  const research = desk.research;
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
    desk.close();
    if (id) setResident(id);
    update((g) =>
      councilCommand(g.crew ? crewCommand(g, { type: "pause" }) : g, {
        type: "pause",
      }),
    );
    setSelected(null);
    setCouncilOpen(true);
  }
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
  const building = game.buildings.find((b) => b.id === selected),
    battle = game.battle,
    raiding = !!battle;
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
          desk.displayed.run,
          desk.displayed.tick,
          game,
          !research && !councilOpen,
        )}
        crewAgents={
          !research && !councilOpen && game.crew?.objective
            ? game.crew.agents
            : undefined
        }
        activeIncidents={activeIncidentTargets(
          desk.displayed.run,
          desk.displayed.tick,
        )}
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
          desk.close();
          setCouncilOpen(false);
        }}
        onCouncil={() => openCouncil()}
        onResearch={desk.open}
      />
      <ResearchOverlay desk={desk} resident={resident} onResident={setResident} />
      {!raiding ? (
        !research && (
          <>
            <CampaignFooter
              game={game}
              saved={saved}
              act={act}
              crewAct={crewAct}
              onInspect={openCrew}
              onCouncil={() => openCouncil()}
              onPanel={setPanel}
              onSelect={setSelected}
              onNotice={setNotice}
            />
            <SelectionPanel
              game={game}
              placing={placing}
              building={building}
              act={act}
              onCancelPlacing={() => setPlacing(null)}
              onClose={() => setSelected(null)}
              onTrain={() => setPanel("train")}
              onMove={setPlacing}
            />
          </>
        )
      ) : battle ? (
        <BattleOverlay
          game={game}
          battle={battle}
          troop={troop}
          squad={squad}
          onTroop={setTroop}
          onSquad={setSquad}
          update={update}
          onDeployed={chime}
          onReturnHome={returnHome}
        />
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
          onResearch: () => desk.open(),
          onError: setNotice,
          onImport: (imported) => {
            if (!update(() => imported)) return;
            desk.close();
            closeVillagePanels();
            setNotice("Village restored from your save.");
          },
        }}
      />
    </main>
  );
}
