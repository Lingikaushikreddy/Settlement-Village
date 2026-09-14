export type Resource = "grain" | "wood" | "water" | "coins";
export type Inventory = Record<Resource, number>;
export type Policy = "baseline" | "cautious" | "evidence";
export type Scenario = "scarcity" | "reputation" | "injection" | "benign";
export type Intervention = "add-grain" | "publish-stock" | "pause-chaos";
export type Config = {
  seed: number;
  scenario: Scenario;
  policy: Policy;
  maxTicks: number;
};
export type Agent = {
  id: string;
  name: string;
  role: "resident" | "chaos";
  occupation: string;
  color: string;
  location: string;
  inventory: Inventory;
  hunger: number;
  trust: number;
  goal: string;
  plan: string[];
};
export type Location = {
  id: string;
  name: string;
  stock: Inventory;
};
export type Memory = {
  id: string;
  owner: string;
  tick: number;
  type: "observation" | "claim" | "outcome";
  text: string;
  source: string;
  salience: number;
};
export type Offer = {
  id: string;
  proposer: string;
  recipient: string;
  give: Partial<Inventory>;
  receive: Partial<Inventory>;
  expiry: number;
  accepted: boolean;
};
export type World = {
  tick: number;
  agents: Agent[];
  locations: Location[];
  memories: Memory[];
  executed: string[];
  consumed: Inventory;
  added: Inventory;
  chaosPaused: boolean;
  verifiedStock: boolean;
  offers: Offer[];
};
export type Action = {
  id: string;
  actor: string;
  type: "move" | "gather" | "consume" | "trade" | "inspect" | "wait" | "offer";
  offerId?: string;
  target?: string;
  resource?: Resource;
  amount?: number;
  give?: Partial<Inventory>;
  receive?: Partial<Inventory>;
};
export type Event = {
  id: string;
  tick: number;
  type:
    | "arrival"
    | "offer"
    | "move"
    | "gather"
    | "consume"
    | "trade"
    | "claim"
    | "inspection"
    | "refusal"
    | "intervention"
    | "outcome"
    | "wait";
  actor: string;
  target?: string;
  title: string;
  detail: string;
  visibility: "public" | "private";
  audience: string[];
  incidentId?: string;
};
export type Decision = {
  id: string;
  tick: number;
  actor: string;
  goal: string;
  plan: string[];
  candidates: {
    action: string;
    score: number;
  }[];
  selected: string;
  summary: string;
  evidenceIds: string[];
  outcome: string;
};
export type Incident = {
  id: string;
  family: Scenario;
  attacker: string;
  target: string;
  tick: number;
  deadline: number;
  claim: string;
  offerPrice: number;
  delivered: boolean;
  decision: "pending" | "checking" | "accepted" | "refused" | "failed";
  outcome: "pending" | "succeeded" | "resisted" | "unresolved" | "benign";
  harm: number;
  detectedTick: number | null;
  resolvedTick: number | null;
  evidenceIds: string[];
  verified: boolean;
  offerId: string;
};
export type Run = {
  schemaVersion: 1;
  engineVersion: string;
  id: string;
  name: string;
  config: Config;
  status: "active" | "completed";
  snapshots: World[];
  checksums: string[];
  events: Event[];
  decisions: Decision[];
  incidents: Incident[];
  interventions: {
    tick: number;
    type: Intervention;
  }[];
  modelCalls: number;
  estimatedCost: number;
};
