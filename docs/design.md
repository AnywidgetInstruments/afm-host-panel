# Design

This page records the design of the plugin, the choices made and the open
points. Requirements are in the [specification](specification.md).

## Versions checked (2026-09-28)

| Component | Version | Notes |
|---|---|---|
| Grafana OSS | 13.2.2 | Latest stable. Supported lines: 12.4, 13.0, 13.1, 13.2. `grafanaDependency` is `>=12.3.0` (scaffold default). |
| `@grafana/create-plugin` | 7.11.0 | Refuses to run on Windows: the skeleton was generated from WSL. |
| `@grafana/data`, `ui`, `runtime` | 13.1.0 (scaffold), 13.2.2 on npm | |
| `@grafana/plugin-e2e` | 3.14.0 | |
| `@anywidget/types` | 0.4.0 | Reference for the model and lifecycle types. |
| anywidget | 0.11.0 | AFM specification at <https://anywidget.dev/en/afm/>. |

## The AFM contract, as checked

The specification and `@anywidget/types` 0.4.0 differ from the summary the
project started from:

| Point | Specification / types | Consequence for the host |
|---|---|---|
| Lifecycle | `initialize({ model, signal, experimental })` once per model, awaited before any `render({ model, el, signal, host, experimental })`. Both may be async. | The host awaits `initialize`, then renders. |
| Cleanup | `initialize` returns nothing, a cleanup function, or an exports object. `render` returns nothing or a cleanup function. The host must abort `signal` on removal and run the cleanup. | The host keeps one `AbortController` per model and per view. |
| Default export | An object, or a function returning (a promise of) the object. | Both are accepted. |
| Events | `change:<trait>` (no arguments) and `msg:custom` (`msg`, `buffers: DataView[]`). A generic `change` event is **not** in the contract. | The shim emits `change` after `change:<trait>`, as Backbone does in Jupyter, because existing widgets rely on it; widgets must not depend on it. |
| `host` | `getWidget(ref)` and `getModel(ref)` for widget composition. Hosts without composition should reject with a clear error. | Both reject with a message naming the reference. |
| `experimental.invoke` | Host specific, not part of the specification. | Rejects: there is no kernel to answer. |
| `widget_manager` | Present in the types (`get_model`). | Provided; `get_model` rejects. |
| `_css` | A trait holding CSS text or a URL, applied by the host. | Supported, scoped to the widget (below). |

## Architecture

```
Grafana (PanelProps) ──► mapping.ts ──► traits ──► model.ts (shim) ◄──► AFM module
       ▲                                                │ save_changes / send
       └──── variables (locationService), options ◄─────┘
```

- **`src/afm/model.ts`**: the model shim, with no React or Grafana import.
  `set` updates the local state and fires `change:<trait>` at once, as in
  Jupyter; the host only sees the changes when the widget calls
  `save_changes`. Host updates (`update`) fire the events without queuing
  anything. Values are compared structurally, so an equal value fires
  nothing. A handler that throws is logged and does not stop the others.
- **`src/afm/loader.ts`**: resolves a module (mode A: registry; mode B: URL),
  validates its shape, runs the lifecycle with abort signals and cleanups,
  and mounts the widget in a shadow root with its CSS.
- **`src/afm/mapping.ts`**: turns data frames, the time range and dashboard
  variables into traits, and routes write-backs.
- **`src/components/AfmPanel.tsx`**: owns one widget instance per module and
  pushes new traits on each render.

## Choices

1. **Shadow DOM isolation (default).** The widget element lives in a shadow
   root attached to the panel element, with the module CSS in a `<style>`
   (text) or `<link>` (URL) inside it. Widget styles cannot leak into
   Grafana, and Grafana styles cannot restyle the widget. A wrapper carries
   `data-theme="light|dark"` from the Grafana theme, a marker understood by
   the anywidget-instruments widgets. An option turns isolation off for
   widgets that search the whole `document` for their own nodes.
2. **Mode A: built-in registry.** Widgets bundled with the plugin, loaded
   lazily as webpack chunks, so that the 800 kB anywidget-instruments bundle
   is only fetched by panels using it. Entries are named `module:Class`, the
   convention of CAN & CANopen Studio (`anywidget_instruments:Gauge`). The
   anywidget-instruments front end is vendored unmodified, with its license
   and commit, by `scripts/vendor-instruments.mjs`.
3. **Mode B: module from a URL.** `import(/* webpackIgnore: true */ url)`.
   Running remote code in the Grafana page is equivalent to letting editors
   write unsanitized HTML, so mode B is enabled only when the Grafana server
   sets `[panels] disable_sanitize_html = true`
   (`GF_PANELS_DISABLE_SANITIZE_HTML`), the switch Grafana already provides
   for that trust level. A panel plugin has no settings page of its own for a
   dedicated switch. The URL must be `https:` or same-origin.
4. **Traits from Grafana.** Each binding names a trait and a source: a field
   reduced with Grafana reducers (`reduceField`, default `lastNotNull`), a
   whole field as an array, a static JSON value, a dashboard variable (through
   `replaceVariables`), or the time range. An unresolved source leaves the
   trait unchanged and adds a diagnostic; the widget keeps its last value.
5. **Write-back.** A trait saved by the widget can update a dashboard
   variable (`locationService.partial({ "var-x": value }, true)`) or the
   panel's static traits (`onOptionsChange`, saved with the dashboard). Other
   saved traits are ignored with one console warning per trait.
6. **`send`.** Messages go to the host, which logs them at debug level.
   `callbacks` are accepted and never called, since no kernel replies.
   `sync_request` messages are answered for built-in widgets that declare how
   (not in the first version).

## CSP and frontend sandbox

- **Content Security Policy.** Off by default in Grafana 13.2.2. The default
  template allows scripts through `'strict-dynamic'`, which should let a
  script-created `import()` load any URL; not tested yet. A stricter policy
  set by an administrator can block mode B; mode A is unaffected because its
  chunks come from the plugin's own origin.
- **Frontend sandbox.** Opt-in per plugin
  (`[security] enable_frontend_sandbox_for_plugins`), off by default. It
  isolates globals and hides DOM nodes outside the panel. Whether dynamic
  `import()` and shadow roots work inside it is not documented; the plugin is
  not tested in the sandbox, and this is listed as a known limitation.
- **Plugin review.** The validator's code review asks whether a plugin loads
  remote scripts. Mode B does, on purpose and behind the server switch above;
  a catalog submission would have to explain it or ship without mode B.

## Open points

- Answering `sync_request` for anywidget-instruments graphs (binary buffers)
  from data frames.
- anywidget-automotives widgets are not implemented upstream yet; the
  registry reserves the `anywidget_automotives:` prefix and the demo uses
  anywidget-instruments widgets arranged as its cluster preview.
- Behavior under the frontend sandbox and a strict CSP.
