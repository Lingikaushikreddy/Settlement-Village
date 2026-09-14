import type { BuildingKind, TroopKind, Resources, Game } from "./model.ts";
export const buildings: Record<
  BuildingKind,
  {
    name: string;
    description: string;
    sprite: number;
    cost: Resources;
    seconds: number;
    resource?: "gold" | "wood" | "food";
    rate: number;
    capacity: number;
  }
> = {
  hall: {
    name: "Town hall",
    description:
      "The heart of Willowmere. Upgrade to unlock stronger buildings.",
    sprite: 0,
    cost: { gold: 600, wood: 400, food: 0 },
    seconds: 20,
    rate: 0,
    capacity: 0,
  },
  mine: {
    name: "Gold mine",
    description: "Mine glittering gold to fund your next adventure.",
    sprite: 1,
    cost: { gold: 100, wood: 150, food: 0 },
    seconds: 8,
    resource: "gold",
    rate: 3,
    capacity: 400,
  },
  mill: {
    name: "Lumber mill",
    description: "Turn timber into a village worth defending.",
    sprite: 2,
    cost: { gold: 150, wood: 80, food: 0 },
    seconds: 8,
    resource: "wood",
    rate: 3,
    capacity: 400,
  },
  farm: {
    name: "Windmill farm",
    description: "A well-fed army is a formidable army.",
    sprite: 3,
    cost: { gold: 120, wood: 120, food: 0 },
    seconds: 8,
    resource: "food",
    rate: 4,
    capacity: 500,
  },
  barracks: {
    name: "Barracks",
    description: "Train knights, archers and siege machines for your army.",
    sprite: 4,
    cost: { gold: 300, wood: 250, food: 0 },
    seconds: 12,
    rate: 0,
    capacity: 0,
  },
  tower: {
    name: "Watchtower",
    description:
      "A village landmark. Enemy watchtowers fire on your raiding troops.",
    sprite: 5,
    cost: { gold: 240, wood: 180, food: 0 },
    seconds: 10,
    rate: 0,
    capacity: 0,
  },
};
export const troops: Record<
  TroopKind,
  {
    name: string;
    role: string;
    sprite: number;
    cost: Resources;
    seconds: number;
    hp: number;
    damage: number;
    range: number;
    speed: number;
  }
> = {
  knight: {
    name: "Knight",
    role: "Frontline · high health",
    sprite: 6,
    cost: { gold: 15, wood: 0, food: 25 },
    seconds: 2,
    hp: 180,
    damage: 22,
    range: 0.75,
    speed: 1.1,
  },
  archer: {
    name: "Archer",
    role: "Ranged · quick on her feet",
    sprite: 7,
    cost: { gold: 20, wood: 0, food: 30 },
    seconds: 3,
    hp: 80,
    damage: 18,
    range: 2.5,
    speed: 1.2,
  },
  catapult: {
    name: "Catapult",
    role: "Siege · devastating at range",
    sprite: 8,
    cost: { gold: 55, wood: 30, food: 40 },
    seconds: 5,
    hp: 120,
    damage: 42,
    range: 3.1,
    speed: 0.65,
  },
};
export const opponents = [
  {
    name: "Thornwood outpost",
    region: "The forest frontier",
    difficulty: "Easy",
    gold: 500,
    wood: 350,
    food: 200,
  },
  {
    name: "Ironcliff encampment",
    region: "Beyond the northern ridge",
    difficulty: "Medium",
    gold: 900,
    wood: 600,
    food: 350,
  },
  {
    name: "The Crimson keep",
    region: "Rook’s last stronghold",
    difficulty: "Hard",
    gold: 1500,
    wood: 1000,
    food: 600,
  },
];
export const quests = [
  {
    id: "gather",
    name: "Stock the storehouse",
    detail: "Collect 150 resources",
    goal: 150,
    stat: "collected",
    reward: 100,
  },
  {
    id: "build",
    name: "Room to grow",
    detail: "Place a new building",
    goal: 1,
    stat: "built",
    reward: 150,
  },
  {
    id: "upgrade",
    name: "Stronger foundations",
    detail: "Finish a building upgrade",
    goal: 1,
    stat: "upgraded",
    reward: 150,
  },
  {
    id: "raid",
    name: "Beyond the treeline",
    detail: "Earn a star in a raid",
    goal: 1,
    stat: "wins",
    reward: 250,
  },
] as const;
export function upgradeCost(kind: BuildingKind, level: number): Resources {
  const c = buildings[kind].cost;
  return {
    gold: Math.round(c.gold * (level + 1) * 0.8),
    wood: Math.round(c.wood * (level + 1) * 0.8),
    food: 0,
  };
}
export function freeBuilders(g: Game) {
  return 2 - g.buildings.filter((b) => b.readyAt !== undefined).length;
}
export function armySize(g: Game) {
  return Object.values(g.army).reduce((a, b) => a + b, 0) + g.training.length;
}
