# Specification

Version 0.4 (2026-09-30). Requirements use the Easy Approach to Requirements
Syntax (EARS). Priorities follow MoSCoW: **M** must, **S** should, **C** could,
**W** won't (this time). Design choices are explained in [Design](design.md).

## Model shim (MOD)

| ID | Pri | Requirement |
|---|---|---|
| MOD-001 | M | The model shim shall provide `get`, `set`, `save_changes`, `on`, `off`, `send` and `widget_manager` with the signatures of `@anywidget/types` 0.4.0. |
| MOD-002 | M | When the widget calls `set` with a value that differs structurally from the current one, the model shall store it and fire `change:<trait>`, then `change`. |
| MOD-003 | M | When the widget calls `set` with a value structurally equal to the current one, the model shall fire no event. |
| MOD-004 | M | The model shall not notify the host of widget changes before `save_changes`. |
| MOD-005 | M | When the widget calls `save_changes`, the model shall pass the changed traits since the last save, with their latest values, to the host, and then clear them. |
| MOD-006 | M | When the host updates traits, the model shall fire the change events without queuing the traits for the next `save_changes`. |
| MOD-007 | M | When `off` is called with an event and a callback, the model shall remove that callback; with an event only, every callback of the event; with no argument, every callback. |
| MOD-008 | M | When the widget calls `send(content, callbacks, buffers)`, the model shall pass the content and the buffers to the host handler. |
| MOD-009 | M | When the host sends a custom message, the model shall fire `msg:custom` with the content and the buffers as `DataView` objects. |
| MOD-010 | S | If an event handler throws, then the model shall log the error and still call the other handlers. |
| MOD-011 | S | When `widget_manager.get_model` is called, the model shall reject with an error stating that the host has no widget manager. |

## Loader (LOAD)

| ID | Pri | Requirement |
|---|---|---|
| LOAD-001 | M | The loader shall accept a module whose default export is a widget object or a function returning one, synchronously or as a promise. |
| LOAD-002 | M | If the module exports neither `initialize` nor `render` as functions, then the loader shall reject with an error naming the module and the expected exports. |
| LOAD-003 | M | The loader shall await `initialize` once per model before the first `render`. |
| LOAD-004 | M | When a widget is removed, the loader shall abort the render signal, run the render cleanup, then abort the model signal and run the initialize cleanup. |
| LOAD-005 | M | The loader shall load built-in widgets from a registry bundled with the plugin (mode A). |
| LOAD-006 | M | Where remote loading is enabled, the loader shall load a module from an `https:` or same-origin URL (mode B). |
| LOAD-007 | M | While remote loading is disabled, when a panel requests a URL, the panel shall show an error message and load nothing. |
| LOAD-008 | M | If loading or running a module fails, then the panel shall show the error message instead of crashing. |
| LOAD-009 | S | The loader shall apply the widget CSS (`_css` trait, text or URL, or the CSS of a registry entry) inside a shadow root that holds the widget. |
| LOAD-010 | S | The loader shall mark the widget container with the Grafana theme (`data-theme="light"` or `"dark"`). |
| LOAD-011 | S | The loader shall pass `signal`, `host` and `experimental` to `initialize` and `render`; `host` and `experimental.invoke` shall reject with a descriptive error. |
| LOAD-012 | C | Where isolation is turned off, the loader shall render the widget in the panel element without a shadow root. |

## Mapping (MAP)

| ID | Pri | Requirement |
|---|---|---|
| MAP-001 | M | The mapping shall set a trait from a field of a data frame reduced with a Grafana reducer (default: last non-null value). |
| MAP-002 | M | The mapping shall set a trait from all the values of a field, as an array. |
| MAP-003 | M | The mapping shall set a trait from a static JSON value. |
| MAP-004 | M | The mapping shall set a trait from a dashboard variable, resolved with `replaceVariables`, parsed as text, number or JSON. |
| MAP-005 | M | The mapping shall set a trait from the time range (start, end, or both, in milliseconds). |
| MAP-006 | M | If a source cannot be resolved (field absent, empty frame, only null values, unresolved variable, invalid number), then the mapping shall leave the trait unchanged and report a diagnostic. |
| MAP-007 | M | When the widget saves a trait bound to a dashboard variable, the panel shall update that variable. |
| MAP-008 | S | When the widget saves a trait bound to the panel options, the panel shall store the value in its static traits. |
| MAP-009 | M | When the widget saves a trait without a write-back binding, the panel shall ignore it and log one console warning for that trait. |
| MAP-010 | S | Where the options ask for it, the panel shall set the `width` and `height` traits to the panel size in pixels. |
| MAP-011 | S | Where the widget is an anywidget-instruments-industrial graph fed by messages (`Sparkline`, `KPITile`, `TrendChart`, `WaveformChart`, `XYGraph`), the panel shall answer its `sync_request` with the message its contract describes, built from the query results: the number fields of the frames, with the time field as the time of a `TrendChart` and the x of an `XYGraph` that has a single number field. |
| MAP-012 | S | When the query results change, the panel shall send the widget of MAP-011 a new message built from them. |
| MAP-013 | S | Where the static traits and the bindings set no `pens` (`TrendChart`), `series` (`XYGraph`) or `n_traces` (`WaveformChart`), the panel shall derive them from the number fields, named after the fields. |

## Panel and editor (PNL)

| ID | Pri | Requirement |
|---|---|---|
| PNL-001 | M | When the panel receives new data, it shall update the traits of the running widget without rendering it again. |
| PNL-002 | M | When the panel is resized, it shall update the size traits when they are enabled. |
| PNL-003 | M | When the panel is removed, it shall run the widget cleanups and remove every subscription. |
| PNL-004 | M | When the widget source changes, the panel shall remove the running widget and load the new one. |
| PNL-005 | M | The options editor shall let the user choose a built-in widget or enter a URL, edit the trait bindings, and edit the static traits as JSON. |
| PNL-006 | S | If the static traits are not a valid JSON object, then the editor shall show the parse error and the panel shall keep the last valid traits. |
| PNL-007 | C | Where diagnostics are enabled, the panel shall list the unresolved bindings under the widget. |

## Integrations (INT)

| ID | Pri | Requirement |
|---|---|---|
| INT-001 | M | The registry shall include the widgets of anywidget-instruments-industrial, named `anywidget_instruments_industrial:<Class>` and bundled without modification of their code. |
| INT-002 | S | The registry shall include the widgets of anywidget-instruments-automotive, named `anywidget_instruments_automotive:<Class>` and bundled without modification of their code; the demo shall show an automotive cluster built from them. |
| INT-003 | M | The repository shall include three demonstration widgets: a counter (write-back), a gauge (scalar value) and a sparkline (series). |
| INT-004 | M | The development server shall provision a demo dashboard on the TestData data source with one panel per demonstration widget. |
| INT-005 | M | The registry descriptions and the documentation of the automotive widgets shall carry the safety notice: the widgets are not vehicle instruments, and none is meant to be operated while driving. |
| INT-006 | M | The registry shall include the widgets of anywidget-instruments-aeronautics, named `anywidget_instruments_aeronautics:<Class>` and bundled without modification of their code, each carrying the notice that it is not certified avionics and never to be used to fly an aircraft or to navigate. |

## Quality and documentation (QA, DOC)

| ID | Pri | Requirement |
|---|---|---|
| QA-001 | M | Unit, component and end-to-end tests shall pass locally and in the continuous integration workflow. |
| QA-002 | M | Type checking, linting and the Grafana plugin validator shall report no blocking error. |
| DOC-001 | M | The documentation shall state the limits of the host: `send` without a kernel, binary buffers, widgets that assume a Python kernel. |
| DOC-002 | M | The documentation shall include an AFM compatibility matrix. |
| DOC-003 | M | The documentation build shall produce `llms.txt` and `llms-full.txt`. |
| DOC-004 | W | Signing and publishing to the Grafana plugin catalog. |

## Revision history

| Version | Date | Changes |
|---|---|---|
| 0.1 | 2026-09-28 | First version. |
| 0.2 | 2026-09-30 | INT-001, INT-002: the libraries are named anywidget-instruments-industrial and anywidget-instruments-automotive, with the prefixes `anywidget_instruments_industrial:` and `anywidget_instruments_automotive:` (the former prefixes are removed); the automotive widgets are bundled instead of previews drawn with industrial widgets. INT-005: safety notice of the automotive widgets. |
| 0.3 | 2026-09-30 | MAP-011 .. MAP-013: the graphs of anywidget-instruments-industrial are fed from the query results through their messages (answer to `sync_request`, new message on every data change, pens, series and traces derived from the fields). |
| 0.4 | 2026-09-30 | INT-006: the widgets of anywidget-instruments-aeronautics, with their safety notice. |
