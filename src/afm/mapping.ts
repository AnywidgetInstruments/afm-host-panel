// Mapping between Grafana and widget traits (MAP-001 .. MAP-009): the traits
// computed from the data frames, the time range and the dashboard variables,
// and the routing of the traits saved by the widget.
import { DataFrame, Field, fieldReducers, FieldType, getFieldDisplayName, reduceField, ReducerID } from '@grafana/data';
import { copy, Traits } from './model';

export type SourceKind = 'field' | 'series' | 'static' | 'variable' | 'time';
export type VariableParse = 'text' | 'number' | 'json';
export type WriteBack = 'none' | 'variable' | 'options';

/** How one trait is computed, and where its saved value goes. */
export interface TraitBinding {
  trait: string;
  source: SourceKind;
  /** field, series: refId or name of the frame; empty for any frame. */
  frame?: string;
  /** field, series: name or display name of the field; empty for the first number field. */
  field?: string;
  /** field: Grafana reducer ID (default lastNotNull). */
  reducer?: string;
  /** static: the value. */
  value?: unknown;
  /** variable: name of the dashboard variable (with or without `$`). */
  variable?: string;
  /** variable: how to read the variable (default text). */
  parse?: VariableParse;
  /** time: start, end, or both of the time range. */
  time?: 'from' | 'to' | 'range';
  /** time: milliseconds since the epoch (default) or ISO 8601 text. */
  timeFormat?: 'ms' | 'iso';
  /** Where a value saved by the widget goes (default none). */
  writeBack?: WriteBack;
  /** variable write-back: target variable, when the source is not that variable. */
  writeVariable?: string;
}

export interface MappingContext {
  series: DataFrame[];
  timeRange: { from: { valueOf(): number }; to: { valueOf(): number } };
  replaceVariables: (text: string) => string;
}

export interface Diagnostic {
  trait: string;
  message: string;
}

type Resolved = { ok: true; value: unknown } | { ok: false; message: string };
const fail = (message: string): Resolved => ({ ok: false, message });
const ok = (value: unknown): Resolved => ({ ok: true, value });

const variableName = (name: string | undefined) => (name ?? '').trim().replace(/^\$\{?|\}$/g, '');

function frameMatches(frame: DataFrame, key: string): boolean {
  return frame.refId === key || frame.name === key;
}

function fieldMatches(field: Field, frame: DataFrame, all: DataFrame[], key: string): boolean {
  return field.name === key || field.config?.displayName === key || getFieldDisplayName(field, frame, all) === key;
}

/** The field a binding refers to, or the reason it cannot be found. */
function findField(binding: TraitBinding, series: DataFrame[]): { field: Field } | { message: string } {
  if (series.length === 0) {
    return { message: 'no data' };
  }
  const frameKey = binding.frame?.trim();
  const frames = frameKey ? series.filter((f) => frameMatches(f, frameKey)) : series;
  if (frames.length === 0) {
    return { message: `frame "${frameKey}" not found` };
  }
  const fieldKey = binding.field?.trim();
  for (const frame of frames) {
    const field = fieldKey
      ? frame.fields.find((f) => fieldMatches(f, frame, series, fieldKey))
      : frame.fields.find((f) => f.type === FieldType.number);
    if (field) {
      return { field };
    }
  }
  if (frames.every((f) => f.fields.length === 0)) {
    return { message: frameKey ? `frame "${frameKey}" has no field` : 'no field in the data' };
  }
  return { message: fieldKey ? `field "${fieldKey}" not found` : 'no number field in the data' };
}

function isNoValue(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value));
}

function resolveField(binding: TraitBinding, ctx: MappingContext): Resolved {
  const found = findField(binding, ctx.series);
  if ('message' in found) {
    return fail(found.message);
  }
  const reducer = binding.reducer?.trim() || ReducerID.lastNotNull;
  if (!fieldReducers.getIfExists(reducer)) {
    return fail(`unknown reducer "${reducer}"`);
  }
  const value = reduceField({ field: found.field, reducers: [reducer] })[reducer];
  return isNoValue(value) ? fail(`no value (${reducer} of "${found.field.name}")`) : ok(value);
}

function resolveSeries(binding: TraitBinding, ctx: MappingContext): Resolved {
  const found = findField(binding, ctx.series);
  if ('message' in found) {
    return fail(found.message);
  }
  return ok(Array.from(found.field.values, (v) => (v === undefined ? null : v)));
}

function resolveVariable(binding: TraitBinding, ctx: MappingContext): Resolved {
  const name = variableName(binding.variable);
  if (!name) {
    return fail('no variable name');
  }
  const parse = binding.parse ?? 'text';
  const expr = parse === 'json' ? `\${${name}:json}` : `\${${name}}`;
  const text = ctx.replaceVariables(expr);
  if (text === expr) {
    return fail(`variable "${name}" is not defined`);
  }
  if (parse === 'number') {
    const n = Number(text);
    return text.trim() !== '' && Number.isFinite(n) ? ok(n) : fail(`variable "${name}" is not a number: "${text}"`);
  }
  if (parse === 'json') {
    try {
      let value: unknown = JSON.parse(text);
      // `:json` of a single-value variable is a JSON string holding the value.
      if (typeof value === 'string') {
        value = JSON.parse(value);
      }
      return ok(value);
    } catch {
      return fail(`variable "${name}" is not valid JSON`);
    }
  }
  return ok(text);
}

function resolveTime(binding: TraitBinding, ctx: MappingContext): Resolved {
  const format = (ms: number) => (binding.timeFormat === 'iso' ? new Date(ms).toISOString() : ms);
  const from = format(ctx.timeRange.from.valueOf());
  const to = format(ctx.timeRange.to.valueOf());
  switch (binding.time ?? 'range') {
    case 'from':
      return ok(from);
    case 'to':
      return ok(to);
    default:
      return ok({ from, to });
  }
}

function resolve(binding: TraitBinding, ctx: MappingContext): Resolved {
  switch (binding.source) {
    case 'field':
      return resolveField(binding, ctx);
    case 'series':
      return resolveSeries(binding, ctx);
    case 'static':
      return ok(copy(binding.value ?? null));
    case 'variable':
      return resolveVariable(binding, ctx);
    case 'time':
      return resolveTime(binding, ctx);
    default:
      return fail(`unknown source "${String(binding.source)}"`);
  }
}

/**
 * Compute the traits of the bindings, in order. A binding that cannot be
 * resolved sets nothing and adds a diagnostic (MAP-006).
 */
export function mapTraits(
  bindings: TraitBinding[],
  ctx: MappingContext
): { traits: Traits; diagnostics: Diagnostic[] } {
  const traits: Traits = {};
  const diagnostics: Diagnostic[] = [];
  for (const binding of bindings) {
    const trait = binding.trait?.trim();
    if (!trait) {
      continue;
    }
    const r = resolve(binding, ctx);
    if (r.ok) {
      traits[trait] = r.value;
    } else {
      diagnostics.push({ trait, message: r.message });
    }
  }
  return { traits, diagnostics };
}

// Write-back -----------------------------------------------------------------

export type WriteBackAction =
  { kind: 'variable'; variable: string; value: string } | { kind: 'options'; trait: string; value: unknown };

/** Logs one warning per ignored trait, for the life of a panel (MAP-009). */
export class WriteBackWarnings {
  private readonly seen = new Set<string>();

  warn(trait: string, message: string): void {
    if (!this.seen.has(trait)) {
      this.seen.add(trait);
      console.warn(`[afm-host] ${message}`);
    }
  }
}

const asVariableValue = (value: unknown): string =>
  typeof value === 'string'
    ? value
    : value === null || value === undefined
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);

/** Route the traits saved by the widget (MAP-007 .. MAP-009). */
export function planWriteBack(
  changes: Traits,
  bindings: TraitBinding[],
  warnings: WriteBackWarnings
): WriteBackAction[] {
  const actions: WriteBackAction[] = [];
  for (const [trait, value] of Object.entries(changes)) {
    // The last binding of a trait decides, as in mapTraits.
    const binding = [...bindings].reverse().find((b) => b.trait?.trim() === trait);
    const mode = binding?.writeBack ?? 'none';
    if (binding && mode === 'variable') {
      const variable =
        variableName(binding.writeVariable) || (binding.source === 'variable' ? variableName(binding.variable) : '');
      if (variable) {
        actions.push({ kind: 'variable', variable, value: asVariableValue(value) });
      } else {
        warnings.warn(
          trait,
          `The widget saved "${trait}", bound to a variable write-back without a variable name: ignored.`
        );
      }
    } else if (binding && mode === 'options') {
      actions.push({ kind: 'options', trait, value: copy(value) });
    } else {
      warnings.warn(
        trait,
        `The widget saved "${trait}", which has no write-back binding: ignored (shown once per trait).`
      );
    }
  }
  return actions;
}
