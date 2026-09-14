"use client";
export type MapResident = {
  id: string;
  name: string;
  color: string;
  location: string;
};
export const coordinates: Record<string, [number, number]> = {
  farm: [220, 195],
  granary: [635, 175],
  market: [460, 365],
  well: [195, 445],
  workshop: [725, 405],
};
const places = [
  ["farm", "Sunfield farm"],
  ["granary", "The granary"],
  ["market", "Market square"],
  ["well", "Willow well"],
  ["workshop", "Oak workshop"],
];
function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cy="10" rx="20" ry="8" fill="#244d4215" />
      <path d="M0 7V-19" stroke="#786b49" strokeWidth="6" />
      <path
        d="M-22-14 Q-31-35-10-39 Q-4-63 16-42 Q38-38 23-17 Q11-5-22-14"
        fill="#73965c"
      />
      <path d="M-20-17 Q-20-36-5-32 Q1-51 15-40 Q32-32 19-20Z" fill="#88a86a" />
    </g>
  );
}
function Building({ kind }: { kind: string }) {
  if (kind === "well")
    return (
      <g>
        <ellipse rx="37" ry="16" fill="#8fa89b" />
        <path
          d="M-28-2v-24q28-16 56 0v24q-28 18-56 0"
          fill="#d4d5be"
          stroke="#8c9d87"
          strokeWidth="3"
        />
        <ellipse cy="-26" rx="28" ry="11" fill="#769bab" />
        <path d="M-34-10v-58M34-10v-58" stroke="#7b6d4a" strokeWidth="6" />
        <path d="M-49-62L0-88l49 26-49 23Z" fill="#626f66" />
        <path d="M0-88v49l49-23" fill="#4c6054" />
      </g>
    );
  if (kind === "market")
    return (
      <g>
        <ellipse cy="10" rx="75" ry="24" fill="#b5b89b" />
        <path d="M-62 0v-62H58V0" fill="#cfb98b" />
        <path d="M-66-58l15-38h92l22 38Z" fill="#f6ebc6" />
        <path d="M-38-58l6-38h20v38M13-58v-38h19l10 38" fill="#ce805e" />
        <path d="M-63-58H62v14H-63Z" fill="#e8d7b1" />
        <path d="M-38-58h26v14h-26M13-58h29v14H13" fill="#ce805e" />
        <path d="M-54-38v38M54-38v38" stroke="#927145" strokeWidth="5" />
        <rect x="-56" y="-13" width="114" height="20" rx="3" fill="#a78250" />
        {[-34, -10, 14, 38].map((x) => (
          <g key={x}>
            <circle
              cx={x}
              cy="-18"
              r="9"
              fill={x < 0 ? "#e1b249" : "#8d9f5f"}
            />
            <circle
              cx={x + 4}
              cy="-25"
              r="6"
              fill={x < 0 ? "#ebc36a" : "#9eac64"}
            />
          </g>
        ))}
      </g>
    );
  return (
    <g>
      <ellipse cy="8" rx="72" ry="22" fill="#244d4217" />
      <path
        d="M-60-12v-69L0-106l61 25v69L0 15Z"
        fill={kind === "granary" ? "#d9bb79" : "#ebd7a5"}
      />
      <path
        d="M0 15v-102l61 6v69Z"
        fill={kind === "granary" ? "#bba16d" : "#cebc8f"}
      />
      <path
        d="M-73-77L-3-128l77 51-63 28Z"
        fill={kind === "granary" ? "#b77756" : "#647c76"}
      />
      <path
        d="M-3-128l14 79 63-28Z"
        fill={kind === "granary" ? "#965e4b" : "#465e58"}
      />
      <path d="M-39 2v-42l24-10v41Z" fill="#77694d" />
      <path
        d="M18-19v-30l24-10v30Z"
        fill="#91b1b0"
        stroke="#eee3be"
        strokeWidth="4"
      />
      {kind === "farm" && (
        <g transform="translate(-45 20)">
          <path d="M-54 0l54-22 90 37-51 25Z" fill="#9e8e59" />
          {[0, 1, 2, 3, 4].map((n) => (
            <path
              key={n}
              d={`M${-43 + n * 16} ${-2 + n * 6}l47-19`}
              stroke="#d6bc62"
              strokeWidth="8"
            />
          ))}
        </g>
      )}
    </g>
  );
}
export function VillageMap({
  residents,
  selected,
  onSelect,
}: {
  residents: MapResident[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <svg
      className="village-svg"
      viewBox="0 0 940 600"
      role="group"
      aria-label="Village map. Select a resident to inspect their decisions."
    >
      <defs>
        <pattern
          id="grass"
          width="46"
          height="43"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M8 14l2-4m0 4l3-2M35 33l-2-5m2 5l3-3"
            stroke="#a2ba83"
            strokeWidth="1.5"
            opacity=".55"
          />
        </pattern>
      </defs>
      <rect width="940" height="600" fill="#d9e6bc" />
      <path d="M0 0H940V65Q795 55 752 15Q491 45 391 20T0 70Z" fill="#b8d095" />
      <path
        d="M0 556Q100 502 191 540T431 576T671 540T940 561V600H0Z"
        fill="#c1d5a1"
      />
      <rect width="940" height="600" fill="url(#grass)" />
      <path
        d="M810-30Q780 60 840 110T872 233T940 348"
        fill="none"
        stroke="#84b6c9"
        strokeWidth="78"
      />
      <path
        d="M817-30Q791 60 847 110T879 233T947 348"
        fill="none"
        stroke="#acd3dc"
        strokeWidth="64"
      />
      <path
        d="M837 15l22 3m-20 58l28 9m12 58l24 1m-28 72l30 3m3 46l22 8"
        fill="none"
        stroke="#e0eeea"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M220 231L453 380 625 211M453 380L204 468M453 380L724 435M453 380L446 603"
          stroke="#afba95"
          strokeWidth="43"
        />
        <path
          d="M220 231L453 380 625 211M453 380L204 468M453 380L724 435M453 380L446 603"
          stroke="#ece2bb"
          strokeWidth="35"
        />
        <path
          d="M220 231L453 380 625 211M453 380L204 468M453 380L724 435M453 380L446 603"
          stroke="#d7cda4"
          strokeWidth="2"
          strokeDasharray="1 18"
        />
      </g>
      {[
        [65, 94, 1.2],
        [113, 117, 1],
        [82, 158, 0.7],
        [358, 72, 1],
        [398, 92, 0.8],
        [736, 66, 1.1],
        [727, 105, 0.7],
        [90, 344, 1.2],
        [47, 386, 0.8],
        [85, 433, 0.7],
        [340, 469, 0.8],
        [598, 478, 1],
        [634, 511, 1.1],
        [850, 466, 1.2],
        [884, 424, 0.8],
        [54, 551, 1],
        [98, 570, 0.8],
      ].map(([x, y, s], i) => (
        <Tree key={i} x={x} y={y} s={s} />
      ))}
      {places.map(([id, name]) => {
        const [x, y] = coordinates[id];
        return (
          <g key={id} transform={`translate(${x} ${y})`}>
            <Building kind={id} />
            <text
              y={id === "farm" ? 76 : 52}
              textAnchor="middle"
              className="place-label"
            >
              {name}
            </text>
          </g>
        );
      })}
      {residents.map((a, i) => {
        const [px, py] = coordinates[a.location] || coordinates.market;
        const x = px + Math.sin(i * 2.3) * 67,
          y = py + 85 + Math.cos(i * 2.3) * 18;
        return (
          <g
            key={a.id}
            className="map-resident"
            role="button"
            tabIndex={0}
            aria-label={`Inspect ${a.name}`}
            aria-pressed={selected === a.id}
            onClick={() => onSelect(a.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(a.id);
              }
            }}
            transform={`translate(${x} ${y})`}
          >
            <title>{a.name}</title>
            {selected === a.id && (
              <ellipse
                cy="7"
                rx="24"
                ry="12"
                fill="#fff8"
                stroke="#244d42"
                strokeWidth="2"
              />
            )}
            <ellipse cy="8" rx="12" ry="5" fill="#264b4125" />
            <path d="M-10 4v-12q10-9 20 0V4Z" fill={a.color} />
            <circle cy="-19" r="9" fill="#e4ba8f" />
            <path
              d="M-10-20q0-17 18-7l2 8q-10-8-20-1"
              fill={i % 2 ? "#725b45" : "#4b4c3f"}
            />
            {selected === a.id && (
              <g>
                <rect
                  x="-36"
                  y="-57"
                  width="72"
                  height="23"
                  rx="11"
                  fill="#244d42"
                />
                <text
                  y="-41"
                  textAnchor="middle"
                  fill="#fff"
                  fontSize="13"
                  fontWeight="600"
                >
                  {a.name}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
