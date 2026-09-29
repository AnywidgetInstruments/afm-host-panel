# Compatibility and limits

The panel is an AFM host without a kernel: nothing runs on the server side of
the widget. A widget works in Grafana when everything it shows can be
computed in the browser from its traits.

## AFM compatibility matrix

Checked against the AFM specification of anywidget 0.11.0 and
`@anywidget/types` 0.4.0.

| AFM feature | Support | Notes |
|---|---|---|
| Default export: widget object | yes | |
| Default export: function returning the widget (sync or async) | yes | |
| `initialize({ model, signal, experimental })` | yes | Awaited once per model, before the first `render`. |
| `initialize` returning a cleanup function | yes | Run after the views are removed. |
| `initialize` returning an exports object | partial | Accepted and kept; no other widget can read it (no composition). |
| `render({ model, el, signal, host, experimental })` | yes | Sync or async; one view per panel. |
| `render` returning a cleanup function | yes | Run once when the panel is removed or the widget changes, also when `render` resolves late. |
| Abort `signal` | yes | Aborted on removal, views first, then the model. |
| `model.get`, `model.set` | yes | Structural comparison: an equal value fires no event. |
| `model.save_changes` | yes | Routed by the write-back of the trait binding; other traits are ignored with a warning. |
| `model.on` / `model.off` | yes | `change:<trait>`, `change` (not in the specification, provided for existing widgets) and `msg:custom`. |
| `model.send(content, callbacks, buffers)` | partial | Accepted and logged at debug level. No kernel receives it; `callbacks` are never called. |
| `msg:custom` from the host | partial | Supported by the model, but the panel sends no messages yet. |
| Binary buffers | partial | Converted to `DataView`; nothing produces them from Grafana data yet. |
| `_css` trait (text or URL) | yes | Applied inside the widget container. |
| `host.getWidget`, `host.getModel` | no | Reject with a message: no widget composition. |
| `widget_manager.get_model` | no | Rejects with a message. |
| `experimental.invoke` | no | Rejects: host specific and needs a kernel. |
| Hot module replacement | no | |

## Limits

- **No kernel.** Widgets that expect a Python (or other) kernel to answer
  (`send` then wait for a reply, `sync_request` for history, computed traits
  arriving from Python) show their default state. Examples: the
  anywidget-instruments graphs that receive data as messages (`TrendChart`,
  `WaveformChart`, `Sparkline`, ...) draw nothing yet.
- **Binary buffers.** Buffers sent by a widget are logged, not forwarded.
- **One view per panel.** Each panel creates its own model: two panels
  showing the same widget do not share state, except through dashboard
  variables.
- **Derived traits.** anywidget-instruments computes some traits in the
  browser (`alarm_level`, `peak`, ...) and saves them. Without a write-back
  binding, they are ignored with one warning per trait.
- **Remote modules** need a server switch and may be blocked by a Content
  Security Policy (see [User guide](guide.md#remote-modules)).
- **Frontend sandbox.** The plugin is not tested with the Grafana frontend
  sandbox (`enable_frontend_sandbox_for_plugins`).
- **Shadow DOM.** Widgets that search `document` for their own nodes need
  isolation turned off.

## Tested widgets

| Widget | Result |
|---|---|
| `examples/counter.js`, `gauge.js`, `sparkline.js` | Unit, component and end-to-end tests |
| anywidget-instruments `Gauge`, `Tank`, `LED`, `ToggleSwitch` | End-to-end (demo dashboard); `ToggleSwitch` writes a variable |
| anywidget-instruments `Thermometer`, `SevenSegment` | Demo dashboard (automotives preview) |
| Other anywidget-instruments widgets | Listed in the registry; not tested one by one |
