export type Resource = "gold" | "wood" | "food";
export type Resources = Record<Resource, number>;
export type BuildingKind =
  | "hall"
  | "mine"
  | "mill"
  | "farm"
  | "barracks"
  | "tower";
export type TroopKind = "knight" | "archer" | "catapult";
export type Building = {
  id: string;
  kind: BuildingKind;
  x: number;
  y: number;
  level: number;
  stored: number;
  readyAt?: number;
  constructing?: boolean;
};
export type Enemy = {
  id: string;
  kind: BuildingKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
};
export type Unit = {
  id: string;
  kind: TroopKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  target?: string;
  attacking?: boolean;
};
export type Battle = {
  level: number;
  elapsed: number;
  units: Unit[];
  buildings: Enemy[];
  focus?: string;
  deployed: number;
  result?: {
    stars: number;
    destruction: number;
    gold: number;
    wood: number;
    food: number;
  };
  settled?: boolean;
};
export type Game = {
  version: 2;
  clock: number;
  serial: number;
  resources: Resources;
  buildings: Building[];
  army: Record<TroopKind, number>;
  training: { kind: TroopKind; readyAt: number }[];
  battle?: Battle;
  trophies: number;
  unlocked: number;
  stats: { collected: number; built: number; upgraded: number; wins: number };
  claimed: string[];
};
export type Command =
  | { type: "build"; kind: BuildingKind; x: number; y: number }
  | { type: "move"; id: string; x: number; y: number }
  | { type: "collect" | "upgrade"; id: string }
  | { type: "train"; kind: TroopKind; count: number }
  | { type: "claim"; id: string };
