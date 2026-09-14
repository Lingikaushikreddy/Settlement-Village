import type { World, Agent, Action } from "./types.ts";
export const graph: Record<string, string[]> = {
  farm: ["market"],
  granary: ["market"],
  market: ["farm", "granary", "well", "workshop"],
  well: ["market"],
  workshop: ["market"],
};
export function pathBetween(from: string, to: string): string[] {
  const q = [[from]],
    seen = new Set<string>();
  while (q.length) {
    const p = q.shift()!;
    const at = p[p.length - 1];
    if (at === to) return p.slice(1);
    if (seen.has(at)) continue;
    seen.add(at);
    for (const n of graph[at] || []) q.push([...p, n]);
  }
  return [];
}
export type PlanResult = {
  goal: string;
  steps: Omit<Action, "id" | "actor">[];
  expanded: number;
};
// Bounded forward state-space search with preconditions/effects. State includes location and grain.
export function planNeeds(world: World, agent: Agent): PlanResult {
  const hungry = agent.hunger >= 45;
  const needGrain = agent.inventory.grain < 4;
  const destination =
    agent.occupation === "Carpenter"
      ? "workshop"
      : agent.occupation === "Waterkeeper"
        ? "well"
        : agent.occupation === "Farmer"
          ? "farm"
          : "market";
  const goal = hungry
    ? "Eat a meal"
    : needGrain
      ? "Build a food reserve"
      : `Work at ${destination}`;
  type State = {
    location: string;
    grain: number;
    fed: boolean;
    stock: Record<string, number>;
    steps: Omit<Action, "id" | "actor">[];
  };
  const q: State[] = [
      {
        location: agent.location,
        grain: agent.inventory.grain,
        fed: false,
        stock: {
          farm:
            agent.location === "farm"
              ? world.locations.find((l) => l.id === "farm")?.stock.grain || 0
              : 4,
          granary:
            agent.location === "granary"
              ? world.locations.find((l) => l.id === "granary")?.stock.grain ||
                0
              : 4,
        },
        steps: [],
      },
    ],
    seen = new Set<string>();
  let expanded = 0;
  while (q.length && expanded < 200) {
    const s = q.shift()!;
    expanded++;
    const done = hungry
      ? s.fed
      : needGrain
        ? s.grain >= 4
        : s.location === destination;
    if (done) return { goal, steps: s.steps, expanded };
    if (s.steps.length >= 6) continue;
    const key = `${s.location}/${s.grain}/${s.fed}/${s.stock.farm}/${s.stock.granary}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (s.grain > 0 && hungry)
      q.push({
        ...s,
        grain: s.grain - 1,
        fed: true,
        steps: [...s.steps, { type: "consume", resource: "grain", amount: 1 }],
      });
    const stock = s.stock[s.location] || 0; // Unvisited food sources have an explicit four-grain prior, never hidden stock.
    if (stock >= 2 && s.grain < 4)
      q.push({
        ...s,
        grain: s.grain + 2,
        stock: { ...s.stock, [s.location]: stock - 2 },
        steps: [...s.steps, { type: "gather", resource: "grain", amount: 2 }],
      });
    for (const target of graph[s.location] || [])
      q.push({
        ...s,
        location: target,
        steps: [...s.steps, { type: "move", target }],
      });
  }
  return { goal, steps: [{ type: "wait" }], expanded };
}
export function describeAction(a: Partial<Action>) {
  if (a.type === "move") return `Walk to ${a.target}`;
  if (a.type === "gather") return `Gather ${a.amount} ${a.resource}`;
  if (a.type === "consume") return "Eat one grain";
  if (a.type === "trade") return "Accept the trade";
  if (a.type === "offer") return "Offer grain for trade";
  if (a.type === "inspect") return "Check the evidence";
  return "Wait and observe";
}
