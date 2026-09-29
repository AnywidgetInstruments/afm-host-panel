import type { TraitBinding } from './afm/mapping';

export type WidgetMode = 'builtin' | 'url';
export type Isolation = 'shadow' | 'none';

/** Options of an AFM host panel. */
export interface AfmOptions {
  /** builtin: a widget of the registry (mode A); url: a module URL (mode B). */
  mode: WidgetMode;
  /** Registry id (`module:Class`) in builtin mode. */
  widget: string;
  /** Module URL in url mode. */
  url: string;
  /** Optional stylesheet URL in url mode. */
  cssUrl: string;
  /** JSON object of traits set before the bindings. */
  staticTraits: string;
  /** Traits computed from Grafana. */
  bindings: TraitBinding[];
  /** Set the width and height traits to the panel size. */
  sizeTraits: boolean;
  /** Render the widget in a shadow root (default) or directly in the panel. */
  isolation: Isolation;
  /** List the bindings that could not be resolved under the widget. */
  showDiagnostics: boolean;
}

export const DEFAULT_OPTIONS: AfmOptions = {
  mode: 'builtin',
  widget: 'examples:Gauge',
  url: '',
  cssUrl: '',
  staticTraits: '{}',
  bindings: [],
  sizeTraits: false,
  isolation: 'shadow',
  showDiagnostics: false,
};
