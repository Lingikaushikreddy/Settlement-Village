import type { ScenarioDefinition } from "./scenario-schema.ts";
import { BUILT_IN_SCENARIOS, isBuiltIn } from "./scenarios/index.ts";

export function scenarioLabel(id: string, definition?: ScenarioDefinition): string {
  if (definition && definition.id === id) return definition.name;
  return isBuiltIn(id) ? BUILT_IN_SCENARIOS[id].name : id;
}
export function scenarioDescription(id: string, definition?: ScenarioDefinition): string {
  if (definition && definition.id === id) return definition.description;
  return isBuiltIn(id) ? BUILT_IN_SCENARIOS[id].description : "";
}
