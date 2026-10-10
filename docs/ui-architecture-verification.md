# UI architecture verification

Measurements from `npm run measure:ui` on the production build (`npm run build && npm start`, then the script against `http://127.0.0.1:5173`). Each row is the change in Chrome's `Performance.getMetrics` counters over 10 s after a 2 s settle: 10 s of the campaign at rest on the home view, and 10 s of the observatory playing a seeded recorded run (`?view=research&seed=42&scenario=scarcity&policy=baseline`) at speed 1. Numbers are for one machine and are not a CI gate; compare rows within one table, not across tables from different machines.

## Baseline (before Plan 1)

Commit: cadb0fa. Machine: darwin arm64. Node: v26.8.1. Chromium: 156.0.8078.4.

| Scene | Script ms | Task ms | Layouts | Style recalcs | Heap Δ MB | Seconds |
| --- | --- | --- | --- | --- | --- | --- |
| campaign idle | 162.0 | 230.0 | 50 | 0 | 2.13 | 10 |
| observatory playback | 297.0 | 367.0 | 21 | 21 | -0.39 | 10 |

Reading: the campaign spends about 16 ms of script per second at rest, one layout per 200 ms tick, and no style recalculation. Playback costs about 30 ms of script per second.

## After Plan 1 (campaign split)

Pending.

## After Plan 2 (research split)

Pending.

## Memoization decisions

None yet. A `React.memo` is listed here with the measurement that justified it, or it is removed.
