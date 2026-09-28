// Loading and lifecycle of anywidget front-end modules (LOAD-001 .. LOAD-012):
// resolve the widget definition from a module, run `initialize` once per
// model and `render` once per view with abort signals and cleanups, and mount
// the widget in a (shadow) container with its CSS.
import type { AnyModel } from '@anywidget/types';

type Cleanup = () => unknown;

/** Widget definition: the default export of an AFM module, once resolved. */
export interface WidgetDef {
  // Hooks are typed loosely: the host passes a superset of what each widget
  // declares, and widgets type their own props.
  initialize?: (props: any) => unknown;
  render?: (props: any) => unknown;
}

/** Error shown to the user when a widget cannot be loaded or run. */
export class AfmLoadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'AfmLoadError';
    if (options && 'cause' in options) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

function isWidgetDef(value: unknown): value is WidgetDef {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { initialize, render } = value as Record<string, unknown>;
  const ok = (hook: unknown) => hook === undefined || typeof hook === 'function';
  return ok(initialize) && ok(render) && (typeof initialize === 'function' || typeof render === 'function');
}

/**
 * Resolve the widget definition of a module (LOAD-001, LOAD-002): the module
 * namespace or the widget itself; the default export may be the widget
 * object or a function returning it (or a promise of it).
 */
export async function resolveWidget(mod: unknown, name: string): Promise<WidgetDef> {
  const expected = `module "${name}" must export (by default) an object with an initialize or render function, or a function returning such an object`;
  let candidate: unknown = mod;
  if (typeof mod === 'object' && mod !== null && 'default' in mod) {
    candidate = (mod as { default: unknown }).default;
  }
  if (typeof candidate === 'function') {
    try {
      candidate = await (candidate as () => unknown)();
    } catch (err) {
      throw new AfmLoadError(`The widget factory of module "${name}" failed: ${messageOf(err)}`, { cause: err });
    }
  }
  if (!isWidgetDef(candidate)) {
    throw new AfmLoadError(`Invalid AFM module: ${expected}.`);
  }
  return candidate;
}

// Lifecycle ------------------------------------------------------------------

const unsupported = (what: string) => () =>
  Promise.reject(new AfmLoadError(`${what} is not supported by this host (Grafana, no kernel).`));

const experimental = { invoke: unsupported('experimental.invoke') };

const host = {
  getWidget: (ref: string) =>
    Promise.reject(new AfmLoadError(`This host cannot compose widgets: cannot resolve widget "${ref}".`)),
  getModel: (ref: string) =>
    Promise.reject(new AfmLoadError(`This host cannot compose widgets: cannot resolve model "${ref}".`)),
};

async function runCleanup(cleanup: Cleanup | undefined, what: string): Promise<void> {
  if (!cleanup) {
    return;
  }
  try {
    await cleanup();
  } catch (err) {
    console.error(`[afm-host] ${what} cleanup failed`, err);
  }
}

export interface ViewHandle {
  /** Abort the view signal and run the render cleanup. */
  remove(): Promise<void>;
}

export interface WidgetInstance {
  /** Exports object returned by `initialize`, if any. */
  exports: object | undefined;
  /** Render a view in `el` (after `initialize`, LOAD-003). */
  render(el: HTMLElement): Promise<ViewHandle>;
  /** Remove every view, then abort the model signal and run the initialize cleanup (LOAD-004). */
  destroy(): Promise<void>;
}

/** Run `initialize` for `model` and return an instance that renders views. */
export async function startWidget(def: WidgetDef, model: AnyModel): Promise<WidgetInstance> {
  const modelController = new AbortController();
  let initCleanup: Cleanup | undefined;
  let exportsObject: object | undefined;
  if (def.initialize) {
    try {
      const result = await def.initialize({ model, signal: modelController.signal, experimental });
      if (typeof result === 'function') {
        initCleanup = result as Cleanup;
      } else if (typeof result === 'object' && result !== null) {
        exportsObject = result;
      }
    } catch (err) {
      modelController.abort();
      throw new AfmLoadError(`The widget initialize function failed: ${messageOf(err)}`, { cause: err });
    }
  }

  const views = new Set<ViewHandle>();
  let destroyed = false;

  const render = async (el: HTMLElement): Promise<ViewHandle> => {
    const controller = new AbortController();
    let removed = false;
    let cleanup: Cleanup | undefined;
    let cleaned = false;
    let settled: Promise<unknown> = Promise.resolve();
    // Runs the render cleanup once, whichever of remove() and a late render comes last.
    const cleanOnce = async () => {
      if (cleanup && !cleaned) {
        cleaned = true;
        await runCleanup(cleanup, 'render');
      }
    };
    const view: ViewHandle = {
      async remove() {
        if (removed) {
          return;
        }
        removed = true;
        views.delete(view);
        controller.abort();
        await settled.catch(() => {});
        await cleanOnce();
      },
    };
    views.add(view);
    if (!def.render || destroyed) {
      return view;
    }
    try {
      settled = Promise.resolve(def.render({ model, el, signal: controller.signal, host, experimental }));
      const result = await settled;
      if (typeof result === 'function') {
        cleanup = result as Cleanup;
        if (removed) {
          // The view was removed while render was pending.
          await cleanOnce();
        }
      }
    } catch (err) {
      views.delete(view);
      controller.abort();
      throw new AfmLoadError(`The widget render function failed: ${messageOf(err)}`, { cause: err });
    }
    return view;
  };

  const destroy = async (): Promise<void> => {
    if (destroyed) {
      return;
    }
    destroyed = true;
    await Promise.all([...views].map((v) => v.remove()));
    modelController.abort();
    await runCleanup(initCleanup, 'initialize');
  };

  return { exports: exportsObject, render, destroy };
}

// Remote modules (mode B) ----------------------------------------------------

/**
 * Check a module URL (LOAD-006): `https:`, or any URL of the page origin.
 * Returns the absolute URL.
 */
export function checkModuleUrl(url: string, baseUrl: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new AfmLoadError('The module URL is empty.');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed, baseUrl);
  } catch {
    throw new AfmLoadError(`Invalid module URL: "${trimmed}".`);
  }
  const base = new URL(baseUrl);
  if (parsed.protocol !== 'https:' && parsed.origin !== base.origin) {
    throw new AfmLoadError(`The module URL must use https or the Grafana origin: "${trimmed}".`);
  }
  return parsed.href;
}

export interface RemoteOptions {
  /** Remote loading allowed by the server configuration (LOAD-007). */
  enabled: boolean;
  /** Base for relative URLs, normally `window.location.href`. */
  baseUrl: string;
  /** Replaceable for tests; defaults to a native dynamic import. */
  importer?: (url: string) => Promise<unknown>;
}

// Native import(), kept out of webpack's module graph.
const nativeImport = (url: string): Promise<unknown> => import(/* webpackIgnore: true */ url);

/** Import an AFM module from a URL (mode B). */
export async function importFromUrl(url: string, options: RemoteOptions): Promise<unknown> {
  if (!options.enabled) {
    throw new AfmLoadError(
      'Loading widgets from a URL is disabled on this Grafana server. An administrator can enable it with [panels] disable_sanitize_html = true.'
    );
  }
  const href = checkModuleUrl(url, options.baseUrl);
  try {
    return await (options.importer ?? nativeImport)(href);
  } catch (err) {
    throw new AfmLoadError(`Cannot load the module ${href}: ${messageOf(err)}`, { cause: err });
  }
}

// Container and CSS ----------------------------------------------------------

export type CssSource = { text: string } | { url: string };

/** Interpret a `_css` trait value: a URL or CSS text (LOAD-009). */
export function cssSourceOf(value: unknown): CssSource | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }
  const v = value.trim();
  if (/^(https?:)?\/\/|^\.{0,2}\/[^\s{}]*$/.test(v) && !/[{}]/.test(v)) {
    return { url: v };
  }
  return { text: value };
}

export interface ContainerOptions {
  isolation: 'shadow' | 'none';
  theme: 'light' | 'dark';
  css?: CssSource[];
}

export interface Container {
  /** Element given to the widget as `el`. */
  el: HTMLElement;
  setTheme(theme: 'light' | 'dark'): void;
  setCss(css: CssSource[]): void;
  dispose(): void;
}

/** Mount the widget container in `target`, in a shadow root by default. */
export function mountContainer(target: HTMLElement, options: ContainerOptions): Container {
  let root: ShadowRoot | HTMLElement = target;
  if (options.isolation === 'shadow') {
    root = target.shadowRoot ?? target.attachShadow({ mode: 'open' });
  }
  const wrapper = document.createElement('div');
  wrapper.className = 'afm-host';
  wrapper.style.width = '100%';
  wrapper.style.height = '100%';
  const styles = document.createElement('div');
  styles.className = 'afm-host-styles';
  const el = document.createElement('div');
  el.className = 'afm-host-widget';
  wrapper.append(styles, el);
  root.append(wrapper);

  const setTheme = (theme: 'light' | 'dark') => {
    wrapper.dataset.theme = theme;
    wrapper.style.colorScheme = theme;
  };
  const setCss = (css: CssSource[]) => {
    styles.replaceChildren(
      ...css.map((source) => {
        if ('url' in source) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = source.url;
          return link;
        }
        const style = document.createElement('style');
        style.textContent = source.text;
        return style;
      })
    );
  };
  setTheme(options.theme);
  setCss(options.css ?? []);
  return { el, setTheme, setCss, dispose: () => wrapper.remove() };
}
