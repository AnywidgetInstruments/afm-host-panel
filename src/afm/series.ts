// Messages that feed the graphs of anywidget-instruments-industrial from the
// query results (MAP-011 .. MAP-013). These widgets do not read their data from
// traits: a new view sends `sync_request`, and the host answers with a message
// carrying binary buffers, in the layout the trait contract of each widget
// describes (`snapshot` or `data`). A kernel keeps that history; here the
// history is the query result, so each change of the data sends a new message.
import { DataFrame, Field, FieldType, getFieldDisplayName } from '@grafana/data';
import type { Traits } from './model';

/** A message from the host to the widget, with its binary buffers. */
export interface HostMessage {
  content: Record<string, unknown>;
  buffers: ArrayBufferView[];
}

interface Column {
  name: string;
  values: number[];
  /** Times of the values, Unix seconds (NaN without a time field). */
  times: number[];
}

/** `_kind` of the graphs fed by messages. */
export const MESSAGE_KINDS = ['sparkline', 'kpitile', 'trendchart', 'waveformchart', 'xygraph'] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export function isMessageKind(kind: unknown): kind is MessageKind {
  return typeof kind === 'string' && (MESSAGE_KINDS as readonly string[]).includes(kind);
}

function toNumber(v: unknown): number {
  return typeof v === 'number' ? v : v === null || v === undefined ? NaN : Number(v);
}

/** The number fields of every frame, with the times of the frame's time field. */
function columns(series: DataFrame[]): Column[] {
  const out: Column[] = [];
  for (const frame of series) {
    const time = frame.fields.find((f: Field) => f.type === FieldType.time);
    const times = time ? Array.from(time.values, (t) => toNumber(t) / 1000) : [];
    for (const field of frame.fields) {
      if (field.type !== FieldType.number) {
        continue;
      }
      const values = Array.from(field.values, toNumber);
      out.push({
        name: getFieldDisplayName(field, frame, series),
        values,
        times: time ? times : values.map(() => NaN),
      });
    }
  }
  return out;
}

/** Keep the last `n` items (a history of at most `n`). */
function last<V>(items: V[], n: unknown): V[] {
  const keep = typeof n === 'number' && n >= 1 ? Math.floor(n) : items.length;
  return items.slice(Math.max(0, items.length - keep));
}

function names(list: unknown): string[] {
  return Array.isArray(list)
    ? list.map((p) => (p && typeof p === 'object' ? String((p as { name?: unknown }).name ?? '') : ''))
    : [];
}

/**
 * Traits derived from the fields when neither the static traits nor the
 * bindings set them (MAP-013): the pens of a TrendChart, the series of an
 * XYGraph, the number of traces of a WaveformChart.
 */
export function derivedTraits(kind: unknown, series: DataFrame[], traits: Traits): Traits {
  if (!isMessageKind(kind)) {
    return {};
  }
  const cols = columns(series);
  if (cols.length === 0) {
    return {};
  }
  const unset = (name: string) =>
    traits[name] === undefined || (Array.isArray(traits[name]) && traits[name].length === 0);
  switch (kind) {
    case 'trendchart':
      return unset('pens') ? { pens: cols.map((c) => ({ name: c.name })) } : {};
    case 'xygraph': {
      const ys = xyColumns(cols).ys;
      return unset('series') ? { series: ys.map((c) => ({ name: c.name })) } : {};
    }
    case 'waveformchart':
      return traits.n_traces === undefined ? { n_traces: cols.length } : {};
    default:
      return {};
  }
}

/** x and y columns of an XYGraph: x is the first number field, or the time when there is only one. */
function xyColumns(cols: Column[]): { x: (c: Column) => number[]; ys: Column[] } {
  if (cols.length === 1) {
    return { x: (c) => c.times, ys: cols };
  }
  const [first, ...rest] = cols;
  return { x: () => first.values, ys: rest };
}

/**
 * The message answering `sync_request`, built from the query results (MAP-011),
 * or undefined when the widget is not fed by messages or there is no data.
 */
export function seriesMessage(kind: unknown, series: DataFrame[], traits: Traits): HostMessage | undefined {
  if (!isMessageKind(kind)) {
    return undefined;
  }
  const cols = columns(series);
  if (cols.length === 0) {
    return undefined;
  }
  switch (kind) {
    case 'sparkline':
    case 'kpitile': {
      const values = last(cols[0].values, traits.history);
      return { content: { type: 'snapshot', n: values.length }, buffers: [Float32Array.from(values)] };
    }
    case 'trendchart': {
      // pens matched by name, else by order
      const penNames = names(traits.pens);
      const entries: Array<[number, number, number]> = [];
      const buffers: ArrayBufferView[] = [];
      cols.forEach((c, i) => {
        const byName = penNames.indexOf(c.name);
        const pen = byName >= 0 ? byName : i;
        if (pen >= penNames.length || entries.some(([p]) => p === pen)) {
          return;
        }
        const keep = last(
          c.times.map((t, k) => [t, c.values[k]] as const).filter(([t]) => Number.isFinite(t)),
          traits.history
        );
        entries.push([pen, keep.length, keep.length]);
        buffers.push(
          Float64Array.from(keep, ([t]) => t),
          Float32Array.from(keep, ([, v]) => v)
        );
      });
      return entries.length ? { content: { type: 'snapshot', pens: entries }, buffers } : undefined;
    }
    case 'waveformchart': {
      const nTraces = typeof traits.n_traces === 'number' && traits.n_traces >= 1 ? Math.floor(traits.n_traces) : 1;
      const traces = cols.slice(0, nTraces);
      const nPoints = Math.min(...traces.map((c) => c.values.length));
      const start = Math.max(0, nPoints - (typeof traits.history === 'number' ? traits.history : nPoints));
      const rows = nPoints - start;
      // one row per point, one column per trace (C order); a missing trace is NaN
      const data = new Float32Array(rows * nTraces).fill(NaN);
      for (let r = 0; r < rows; r++) {
        traces.forEach((c, t) => {
          data[r * nTraces + t] = c.values[start + r];
        });
      }
      return { content: { type: 'snapshot', n_points: rows, total: rows }, buffers: [data] };
    }
    case 'xygraph': {
      const setNames = names(traits.series);
      const { x, ys } = xyColumns(cols);
      const sets: Array<[string, number]> = [];
      const buffers: ArrayBufferView[] = [];
      for (const c of ys) {
        if (setNames.length > 0 && !setNames.includes(c.name)) {
          continue; // data of a name not listed are dropped by the widget anyway
        }
        const xs = x(c);
        const n = Math.min(xs.length, c.values.length);
        sets.push([c.name, n]);
        buffers.push(Float64Array.from(xs.slice(0, n)), Float64Array.from(c.values.slice(0, n)));
      }
      return sets.length ? { content: { type: 'data', clear: true, sets }, buffers } : undefined;
    }
  }
}
