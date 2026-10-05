# UI — loading system

Component: `src/components/PulseLoader.tsx` · Animations: `src/index.css`

## Principle

Pages render immediately and data loads in the background. While a section is still loading, the wait is shown **over that section** — the surrounding page (headers, step tabs, other panels) is already interactive, and nothing is blocked by a full-page spinner.

## Components

### `<PulseLoader size label />`

The MedPark logo **beating like a heart** with an **ECG trace sweeping** around it. Self-contained SVG so it can be themed and sized anywhere.

- `mp-heartbeat` — double-thump scale pulse (1 → 1.18 → 1 → 1.12 → 1 over 1.2s) plus an orange drop-shadow glow.
- `mp-ecg-flow` — the ECG path draws itself around the ring via animated `stroke-dashoffset`, like a monitor sweep.
- `mp-ring-breathe` — a soft halo circle behind the logo that breathes in opacity/scale.
- `role="status"` + `aria-live="polite"` + a visually hidden "Loading" label for screen readers.

Props: `size` (px, default 64), `label` (optional caption).

### `<SectionLoader minHeight label />`

Placeholder shown **in place of** a section while its data loads. Keeps layout space so the page doesn't jump (`minHeight` default 180).

### `<OverlayLoader label />`

Sits **on top of** a section that keeps its content/space in the layout while refreshing — previous content stays visible underneath a translucent, lightly blurred backdrop.

## Where it is used

| Page | Section |
|---|---|
| Dashboard | banks grid |
| QBank | provider grid, question-banks-underneath grid |
| Workspace → Welcome | statistics (donuts, tiles, bell curve) |
| Workspace → Create Test | subjects section, systems section |
| Workspace → Previous Tests | test table |
| Test page | test loading state |
| Library | sidebar structure (replaced the old spinner) and article pane (over the skeleton lines) |

## Usage

```tsx
import { SectionLoader, OverlayLoader, PulseLoader } from '@/components/PulseLoader';

{query.isLoading ? (
  <SectionLoader minHeight={220} label="Loading banks" />
) : (
  <div className="relative">
    {query.isFetching && <OverlayLoader />}   {/* keeps previous data visible */}
    {data}
  </div>
)}
```

Prefer these over ad-hoc spinners or `animate-pulse` skeletons so loading looks the same everywhere.