// Built-in widgets (mode A, LOAD-005): bundled with the plugin and loaded
// lazily, so a dashboard only fetches the widgets it uses. Entries are named
// `module:Class`.
//
// - `examples:*`: the demonstration widgets of examples/, imported as modules.
// - `anywidget_instruments_industrial:*`: the anywidget-instruments-industrial
//   front end, vendored unmodified as ESM text and imported through a blob:
//   URL, as anywidget hosts load `_esm` (INT-001).
// - `anywidget_instruments_automotive:*`: the anywidget-instruments-automotive
//   front end, vendored and loaded the same way (INT-002).
import type { CssSource } from './loader';
import type { Traits } from './model';
import { INSTRUMENTS_KINDS } from '../widgets/anywidget-instruments/kinds';
import { AUTOMOTIVE_KINDS } from '../widgets/anywidget-instruments-automotive/kinds';

export type Importer = (url: string) => Promise<unknown>;

export interface LoadedWidget {
  /** The module namespace (or widget object) to pass to resolveWidget. */
  module: unknown;
  /** CSS applied in the widget container. */
  css: CssSource[];
}

export interface RegistryEntry {
  id: string;
  label: string;
  group: string;
  description: string;
  /** Traits set before the panel's own traits. */
  defaults: Traits;
  load(importer?: Importer): Promise<LoadedWidget>;
}

const nativeImport: Importer = (url) => import(/* webpackIgnore: true */ url);

/** Import an ES module from its source text through a blob: URL. */
export async function importEsmText(text: string, importer: Importer = nativeImport): Promise<unknown> {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
  try {
    return await importer(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Demonstration widgets ------------------------------------------------------

const examples: RegistryEntry[] = [
  {
    id: 'examples:Counter',
    label: 'Counter',
    description: 'Button adding a step to a value; writes the value back (save_changes).',
    defaults: { value: 0, step: 1, label: 'Counter' },
    load: async () => ({ module: await import('../../examples/counter.js'), css: [] }),
  },
  {
    id: 'examples:Gauge',
    label: 'Gauge',
    description: 'One scalar value on an arc (value, min, max, unit, label).',
    defaults: { value: 0, min: 0, max: 100, unit: '', label: '' },
    load: async () => ({ module: await import('../../examples/gauge.js'), css: [] }),
  },
  {
    id: 'examples:Sparkline',
    label: 'Sparkline',
    description: 'A series of values as a line (values, label, unit).',
    defaults: { values: [], label: '', unit: '' },
    load: async () => ({ module: await import('../../examples/sparkline.js'), css: [] }),
  },
].map((e) => ({ ...e, group: 'Examples' }));

// anywidget-instruments-industrial -------------------------------------------

let instruments: Promise<LoadedWidget> | undefined;

function loadInstruments(importer?: Importer): Promise<LoadedWidget> {
  if (!instruments) {
    instruments = (async () => {
      const [{ default: esm }, { default: css }] = await Promise.all([
        import(/* webpackChunkName: "anywidget-instruments" */ '../widgets/anywidget-instruments/esm'),
        import(/* webpackChunkName: "anywidget-instruments" */ '../widgets/anywidget-instruments/css'),
      ]);
      return { module: await importEsmText(esm, importer), css: [{ text: css }] };
    })();
    instruments.catch(() => (instruments = undefined)); // retry on the next request
  }
  return instruments;
}

const instrumentEntries: RegistryEntry[] = Object.entries(INSTRUMENTS_KINDS).map(([cls, kind]) => ({
  id: `anywidget_instruments_industrial:${cls}`,
  label: cls,
  group: 'anywidget-instruments-industrial',
  description: `anywidget-instruments-industrial ${cls} (_kind "${kind}").`,
  // "system": follow the data-theme of the panel container (the Grafana theme).
  defaults: { _kind: kind, theme: 'system' },
  load: loadInstruments,
}));

// anywidget-instruments-automotive -------------------------------------------

/** Shown with every automotive widget (INT-005). */
export const AUTOMOTIVE_SAFETY_NOTICE =
  'For visualization and teaching only, not a vehicle instrument: no widget is meant to be operated while driving.';

let automotive: Promise<LoadedWidget> | undefined;

function loadAutomotive(importer?: Importer): Promise<LoadedWidget> {
  if (!automotive) {
    automotive = (async () => {
      const [{ default: esm }, { default: css }] = await Promise.all([
        import(
          /* webpackChunkName: "anywidget-instruments-automotive" */ '../widgets/anywidget-instruments-automotive/esm'
        ),
        import(
          /* webpackChunkName: "anywidget-instruments-automotive" */ '../widgets/anywidget-instruments-automotive/css'
        ),
      ]);
      return { module: await importEsmText(esm, importer), css: [{ text: css }] };
    })();
    automotive.catch(() => (automotive = undefined)); // retry on the next request
  }
  return automotive;
}

const automotiveEntries: RegistryEntry[] = Object.entries(AUTOMOTIVE_KINDS).map(([cls, kind]) => ({
  id: `anywidget_instruments_automotive:${cls}`,
  label: cls,
  group: 'anywidget-instruments-automotive',
  description: `anywidget-instruments-automotive ${cls} (_kind "${kind}"). ${AUTOMOTIVE_SAFETY_NOTICE}`,
  defaults: { _kind: kind, theme: 'system' },
  load: loadAutomotive,
}));

const ALL: RegistryEntry[] = [...examples, ...instrumentEntries, ...automotiveEntries];
const BY_ID = new Map(ALL.map((e) => [e.id, e]));

export function listWidgets(): RegistryEntry[] {
  return ALL;
}

export function findWidget(id: string): RegistryEntry | undefined {
  return BY_ID.get(id);
}
