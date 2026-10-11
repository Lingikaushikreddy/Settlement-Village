"use client";
import { Coins, TreePine, Wheat } from "lucide-react";
import type { Game, Resources } from "@/lib/game/model";

/** One icon per resource, shared by the HUD and every cost label. */
export const resourceIcons = { gold: Coins, wood: TreePine, food: Wheat };

export function Cost({ cost }: { cost: Partial<Resources> }) {
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

export function download(g: Game) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(
      new Blob([JSON.stringify(g, null, 2)], { type: "application/json" }),
    );
  a.href = url;
  a.download = "Settlement-village.json";
  a.click();
  URL.revokeObjectURL(url);
}
