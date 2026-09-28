// Model shim of the anywidget front-end module (AFM) contract: the object a
// widget receives as `model`. It keeps the traits in memory and routes
// `save_changes` and `send` to the host (MOD-001 .. MOD-011). It has no
// React or Grafana dependency.
import type { AnyModel } from '@anywidget/types';

export type Traits = Record<string, unknown>;
// `any[]` as in `EventHandler` of @anywidget/types: `msg:custom` handlers take
// typed arguments, which `unknown[]` would reject.
export type Handler = (...args: any[]) => void;
export type BufferLike = ArrayBuffer | ArrayBufferView;

/** Receives what the widget sends to the host. */
export interface ModelHost {
  /** Traits changed by the widget since the last save, with their latest values. */
  onSave?: (changes: Traits) => void;
  /** Custom message sent by the widget, buffers as DataView. */
  onSend?: (content: unknown, buffers: DataView[]) => void;
}

/** Structural equality of JSON-like values (NaN equals NaN). */
export function isEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    if (!ArrayBuffer.isView(a) || !ArrayBuffer.isView(b) || a.byteLength !== b.byteLength) {
      return false;
    }
    const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    const y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    return x.every((v, i) => v === y[i]);
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => isEqual(v, b[i]));
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  const bb = b as Traits;
  return (
    ka.length === kb.length &&
    ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && isEqual((a as Traits)[k], bb[k]))
  );
}

/** Deep copy of a JSON-like value; typed arrays and buffers are copied too. */
export function copy<V>(value: V): V {
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return value.slice(0) as V;
  }
  if (value instanceof DataView) {
    return new DataView(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)) as V;
  }
  if (ArrayBuffer.isView(value)) {
    return (value as unknown as { slice(): V }).slice();
  }
  if (Array.isArray(value)) {
    return value.map(copy) as V;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    return value; // class instances (Date, DOM nodes, ...): passed by reference
  }
  const out: Traits = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = copy(v);
  }
  return out as V;
}

/** A buffer as a DataView over the same bytes (the view window is kept). */
export function toDataView(buffer: BufferLike): DataView {
  if (buffer instanceof DataView) {
    return buffer;
  }
  if (ArrayBuffer.isView(buffer)) {
    return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
  return new DataView(buffer);
}

export class AfmModel<T extends Traits = Traits> implements AnyModel<T> {
  private readonly traits: Traits;
  private readonly pending = new Set<string>();
  private readonly handlers = new Map<string, Handler[]>();

  readonly widget_manager = {
    get_model: (modelId: string): Promise<never> =>
      Promise.reject(new Error(`This host has no widget manager: cannot resolve model "${modelId}".`)),
  };

  constructor(
    initial: Partial<T>,
    private readonly host: ModelHost = {}
  ) {
    this.traits = copy({ ...initial });
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.traits[key as string] as T[K];
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    const name = key as string;
    if (isEqual(this.traits[name], value)) {
      return;
    }
    this.traits[name] = copy(value);
    this.pending.add(name);
    this.emit(`change:${name}`);
    this.emit('change');
  }

  save_changes(): void {
    if (this.pending.size === 0) {
      return;
    }
    const changes: Traits = {};
    for (const name of this.pending) {
      changes[name] = copy(this.traits[name]);
    }
    this.pending.clear();
    this.host.onSave?.(changes);
  }

  on(eventName: string, callback: Handler): void {
    const list = this.handlers.get(eventName) ?? [];
    list.push(callback);
    this.handlers.set(eventName, list);
  }

  off(eventName?: string | null, callback?: Handler | null): void {
    if (!eventName && !callback) {
      this.handlers.clear();
      return;
    }
    const names = eventName ? [eventName] : [...this.handlers.keys()];
    for (const name of names) {
      const remaining = callback ? (this.handlers.get(name) ?? []).filter((h) => h !== callback) : [];
      if (remaining.length > 0) {
        this.handlers.set(name, remaining);
      } else {
        this.handlers.delete(name);
      }
    }
  }

  /**
   * Send a custom message to the host. `callbacks` (Jupyter kernel replies)
   * are accepted for compatibility and never called: no kernel answers.
   */
  send(content: unknown, _callbacks?: unknown, buffers?: BufferLike[]): void {
    this.host.onSend?.(content, (buffers ?? []).map(toDataView));
  }

  // Host side -------------------------------------------------------------

  /** Set traits from the host: fires the change events, queues nothing. */
  update(patch: Partial<T>): void {
    const changed: string[] = [];
    for (const [name, value] of Object.entries(patch)) {
      if (!isEqual(this.traits[name], value)) {
        this.traits[name] = copy(value);
        changed.push(name);
      }
    }
    for (const name of changed) {
      this.emit(`change:${name}`);
    }
    if (changed.length > 0) {
      this.emit('change');
    }
  }

  /** Deliver a custom message from the host to the widget (`msg:custom`). */
  emitCustom(content: unknown, buffers: BufferLike[] = []): void {
    this.emit('msg:custom', content, buffers.map(toDataView));
  }

  /** Copy of every trait. */
  snapshot(): T {
    return copy(this.traits) as T;
  }

  /** Number of registered callbacks, over all events. */
  listenerCount(): number {
    let n = 0;
    for (const list of this.handlers.values()) {
      n += list.length;
    }
    return n;
  }

  private emit(eventName: string, ...args: unknown[]): void {
    // Copy: a handler may add or remove handlers while the event is fired.
    for (const handler of [...(this.handlers.get(eventName) ?? [])]) {
      try {
        handler(...args);
      } catch (err) {
        console.error(`[afm-host] handler of "${eventName}" failed`, err);
      }
    }
  }
}
