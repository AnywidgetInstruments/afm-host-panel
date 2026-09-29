// Panel options helpers: static traits as JSON (PNL-006) and write-back of a
// saved trait into the options (MAP-008).
import type { AfmOptions } from '../types';
import { copy, Traits } from './model';

export type StaticTraits = { ok: true; traits: Traits } | { ok: false; error: string };

/** Parse the static traits JSON; empty text is an empty object. */
export function parseStaticTraits(text: string | undefined): StaticTraits {
  if (!text || text.trim() === '') {
    return { ok: true, traits: {} };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: 'The static traits must be a JSON object, such as {"label": "Speed"}.' };
  }
  return { ok: true, traits: value as Traits };
}

/**
 * Options after the widget saved `trait` with an options write-back: the
 * value of the static binding of that trait, or else the static traits.
 */
export function applyOptionsWriteBack(options: AfmOptions, trait: string, value: unknown): AfmOptions {
  const bindings = options.bindings ?? [];
  let index = -1;
  bindings.forEach((b, i) => {
    if (b.trait?.trim() === trait && b.source === 'static') {
      index = i;
    }
  });
  if (index >= 0) {
    return { ...options, bindings: bindings.map((b, i) => (i === index ? { ...b, value: copy(value) } : b)) };
  }
  const parsed = parseStaticTraits(options.staticTraits);
  const traits = parsed.ok ? { ...parsed.traits } : {};
  traits[trait] = copy(value);
  return { ...options, staticTraits: JSON.stringify(traits, null, 2) };
}
