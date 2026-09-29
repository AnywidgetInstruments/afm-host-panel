// Built-in widgets (mode A, LOAD-005): bundled with the plugin and loaded
// lazily, so a dashboard only fetches the widgets it uses. Entries are named
// `module:Class`.
//
// - `examples:*`: the demonstration widgets of examples/, imported as modules.
// - `anywidget_instruments:*`: the anywidget-instruments front end, vendored
//   unmodified as ESM text and imported through a blob: URL, as anywidget
//   hosts load `_esm` (INT-001).
// - `anywidget_automotives:*`: previews of the planned anywidget-automotives
//   widgets, drawn with anywidget-instruments widgets as in its cluster
//   preview, until anywidget-automotives publishes its front end (INT-002).
import type { CssSource } from './loader';
import type { Traits } from './model';
import { INSTRUMENTS_KINDS } from '../widgets/anywidget-instruments/kinds';

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
  /** True for a stand-in of a widget that is not published yet. */
  preview?: boolean;
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

// anywidget-instruments ------------------------------------------------------

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
  id: `anywidget_instruments:${cls}`,
  label: cls,
  group: 'anywidget-instruments',
  description: `anywidget-instruments ${cls} (_kind "${kind}").`,
  // "system": follow the data-theme of the panel container (the Grafana theme).
  defaults: { _kind: kind, theme: 'system' },
  load: loadInstruments,
}));

// anywidget-automotives previews ---------------------------------------------

// Traits of the cluster preview of anywidget-automotives
// (lite/marimo/cluster_preview.py), drawn with anywidget-instruments.
const AMBER = '#ffb300';
const RED = '#d32f2f';
const OFF = '#3a3a3a';

const automotives: Array<[string, string, string, Traits]> = [
  ['Speedometer', 'Gauge', 'Vehicle speed', { min: 0, max: 200, unit: 'km/h', label: 'Speed' }],
  [
    'Tachometer',
    'Gauge',
    'Engine speed with amber and red zones',
    {
      min: 0,
      max: 7000,
      unit: 'rpm',
      label: 'Engine speed',
      ranges: [
        { from: 5500, to: 6200, color: AMBER },
        { from: 6200, to: 7000, color: RED },
      ],
    },
  ],
  [
    'FuelGauge',
    'Tank',
    'Fuel level with low-fuel limit',
    { min: 0, max: 100, unit: '%', label: 'Fuel', lo: 12, show_limits: true },
  ],
  [
    'TemperatureGauge',
    'Thermometer',
    'Coolant temperature',
    { min: 40, max: 130, unit: '°C', label: 'Coolant', hi: 110, hihi: 115 },
  ],
  ['TellTale', 'LED', 'Tell-tale (engine warning, amber)', { label: 'Engine', on_color: AMBER, off_color: OFF }],
  ['TripComputer', 'SevenSegment', 'Trip computer figure', { digits: 4, decimals: 1, unit: 'L/h', label: 'Fuel rate' }],
];

const automotiveEntries: RegistryEntry[] = automotives.map(([cls, base, description, traits]) => ({
  id: `anywidget_automotives:${cls}`,
  label: `${cls} (preview)`,
  group: 'anywidget-automotives (preview)',
  description: `${description}. Preview drawn with anywidget-instruments ${base}; anywidget-automotives has not published its widgets yet.`,
  defaults: { _kind: INSTRUMENTS_KINDS[base], theme: 'system', ...traits },
  preview: true,
  load: loadInstruments,
}));

const ALL: RegistryEntry[] = [...examples, ...instrumentEntries, ...automotiveEntries];
const BY_ID = new Map(ALL.map((e) => [e.id, e]));

export function listWidgets(): RegistryEntry[] {
  return ALL;
}

export function findWidget(id: string): RegistryEntry | undefined {
  return BY_ID.get(id);
}
