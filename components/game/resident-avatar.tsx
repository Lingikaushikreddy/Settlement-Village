import type { CSSProperties } from "react";
import "./resident-avatar.css";

const residentIndex: Record<string, number> = {
  mira: 0,
  theo: 1,
  ada: 2,
  finn: 3,
  lina: 4,
  oscar: 5,
};

/** Shared resident identity for the village, crew, and Council. */
export function ResidentAvatar({
  id,
  size = 44,
  className = "",
  variant = "portrait",
}: {
  id: string;
  size?: number;
  className?: string;
  variant?: "portrait" | "full";
}) {
  const index = residentIndex[id];
  return (
    <span
      aria-hidden="true"
      className={`resident-avatar resident-avatar--${variant} ${index === undefined ? "resident-avatar--unknown" : ""} ${className}`}
      style={
        {
          "--resident-size": `${size}px`,
          "--resident-column": index === undefined ? 0 : (index % 3) * 50,
          "--resident-row": index === undefined ? 0 : Math.floor(index / 3) * 100,
        } as CSSProperties
      }
    >
      {index === undefined ? (
        id.slice(0, 1).toUpperCase()
      ) : (
        <span className="resident-avatar-art" />
      )}
    </span>
  );
}
