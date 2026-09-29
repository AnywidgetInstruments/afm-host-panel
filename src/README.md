# AFM host

Run anywidget front-end modules (AFM) in a Grafana panel. Widgets written for
Jupyter with anywidget work unchanged: the panel gives them an element and a
model fed by Grafana.

![The demonstration dashboard](https://raw.githubusercontent.com/s-celles/afm-host-panel/main/docs/img/demo-dark.png)

## Features

- Built-in widgets: a counter, a gauge and a sparkline; the widgets of
  anywidget-instruments (gauges, tanks, thermometers, LEDs, switches,
  seven-segment displays, ...); previews of anywidget-automotives.
- Trait bindings: a field reduced by a Grafana reducer, all the values of a
  field, a static JSON value, a dashboard variable, or the time range.
- Write-back: a value saved by the widget (a click, a switch) can set a
  dashboard variable or the panel options.
- Widgets are isolated in a shadow root and follow the Grafana theme.
- Optional: modules loaded from a URL, when the administrator sets
  `[panels] disable_sanitize_html = true`.

## Requirements

Grafana 12.3 or later.

## Limits

There is no kernel: widgets that need a Python kernel to answer their
messages show their default state. See the compatibility matrix in the
repository documentation: <https://github.com/s-celles/afm-host-panel/blob/main/docs/compatibility.md>.

## License

MIT. Bundled anywidget-instruments front end: BSD-3-Clause.
