import { PanelPlugin } from '@grafana/data';
import { AfmOptions, DEFAULT_OPTIONS } from './types';
import { AfmPanel } from './components/AfmPanel';
import { BindingsEditor } from './components/BindingsEditor';
import { StaticTraitsEditor } from './components/StaticTraitsEditor';
import { listWidgets } from './afm/registry';

const WIDGET = 'Widget';
const TRAITS = 'Traits';
const DISPLAY = 'Display';

export const plugin = new PanelPlugin<AfmOptions>(AfmPanel).setPanelOptions((builder) =>
  builder
    .addRadio({
      path: 'mode',
      name: 'Source',
      category: [WIDGET],
      defaultValue: DEFAULT_OPTIONS.mode,
      settings: {
        options: [
          { value: 'builtin', label: 'Built-in widget' },
          { value: 'url', label: 'Module URL' },
        ],
      },
    })
    .addSelect({
      path: 'widget',
      name: 'Widget',
      description: 'Widgets bundled with the plugin, named module:Class',
      category: [WIDGET],
      defaultValue: DEFAULT_OPTIONS.widget,
      settings: {
        options: listWidgets().map((w) => ({
          value: w.id,
          label: `${w.group}: ${w.label}`,
          description: w.description,
        })),
      },
      showIf: (o) => o.mode !== 'url',
    })
    .addTextInput({
      path: 'url',
      name: 'Module URL',
      description:
        'URL of an AFM module (https or the Grafana origin). Requires [panels] disable_sanitize_html = true on the server.',
      category: [WIDGET],
      defaultValue: DEFAULT_OPTIONS.url,
      settings: { placeholder: 'https://example.org/widget.js' },
      showIf: (o) => o.mode === 'url',
    })
    .addTextInput({
      path: 'cssUrl',
      name: 'Stylesheet URL',
      description: 'Optional CSS applied inside the widget container',
      category: [WIDGET],
      defaultValue: DEFAULT_OPTIONS.cssUrl,
      showIf: (o) => o.mode === 'url',
    })
    .addCustomEditor({
      id: 'bindings',
      path: 'bindings',
      name: 'Trait bindings',
      description: 'Traits computed from the query results, dashboard variables or the time range',
      category: [TRAITS],
      defaultValue: DEFAULT_OPTIONS.bindings,
      editor: BindingsEditor,
    })
    .addCustomEditor({
      id: 'staticTraits',
      path: 'staticTraits',
      name: 'Static traits',
      description: 'JSON object of traits, applied before the bindings',
      category: [TRAITS],
      defaultValue: DEFAULT_OPTIONS.staticTraits,
      editor: StaticTraitsEditor,
    })
    .addBooleanSwitch({
      path: 'sizeTraits',
      name: 'Size traits',
      description: 'Set the width and height traits to the panel size in pixels',
      category: [TRAITS],
      defaultValue: DEFAULT_OPTIONS.sizeTraits,
    })
    .addRadio({
      path: 'isolation',
      name: 'Isolation',
      description: 'A shadow root keeps widget and Grafana styles apart',
      category: [DISPLAY],
      defaultValue: DEFAULT_OPTIONS.isolation,
      settings: {
        options: [
          { value: 'shadow', label: 'Shadow DOM' },
          { value: 'none', label: 'None' },
        ],
      },
    })
    .addBooleanSwitch({
      path: 'showDiagnostics',
      name: 'Show diagnostics',
      description: 'List the bindings that could not be resolved',
      category: [DISPLAY],
      defaultValue: DEFAULT_OPTIONS.showDiagnostics,
    })
);
