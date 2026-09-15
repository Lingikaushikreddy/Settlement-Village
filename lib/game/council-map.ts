import type { Game, BuildingKind } from "./model.ts";
export function councilLocations(game: Game) {
  const hall = game.buildings.find((b) => b.kind === "hall")!;
  const building = (kind: BuildingKind) =>
    game.buildings
      .filter((b) => b.kind === kind)
      .sort((a, b) => b.level - a.level)[0] ?? hall;
  const used = new Set(game.buildings.map((b) => `${b.x},${b.y}`));
  function clearing(x: number, y: number) {
    const tiles = Array.from({ length: 81 }, (_, i) => ({
      x: i % 9,
      y: Math.floor(i / 9),
    }));
    const tile = tiles
      .filter((t) => !used.has(`${t.x},${t.y}`))
      .sort(
        (a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
      )[0];
    used.add(`${tile.x},${tile.y}`);
    return tile;
  }
  return {
    farm: building("farm"),
    granary: hall,
    workshop: building("mill"),
    market: clearing(hall.x + 1, hall.y),
    well: clearing(hall.x + 2, hall.y - 1),
  };
}
