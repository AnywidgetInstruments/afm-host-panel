# afm-host-panel

A Grafana panel plugin that hosts anywidget front-end modules (AFM). The
panel loads a widget module, gives it an element and a model, and feeds the
model from Grafana: query results, the time range and dashboard variables.
Widgets written for Jupyter run unchanged, within the limits listed in
[Compatibility and limits](compatibility.md). A widget can write back to a
dashboard variable.

![The demonstration dashboard](img/demo-dark.png#only-dark)
![The demonstration dashboard](img/demo-light.png#only-light)

The widgets follow the Grafana theme, light or dark.

## Built-in widgets

<div class="grid cards" markdown>

-   **[anywidget-instruments](instruments.md)**

    ---

    [![anywidget-instruments-industrial gallery](img/instruments-dark.png#only-dark)](instruments.md)
    [![anywidget-instruments-industrial gallery](img/instruments-light.png#only-light)](instruments.md)

    52 instrumentation widgets, bundled unmodified: gauges, tanks, LEDs,
    switches, process objects, charts.

-   **[anywidget-instruments-automotive](automotives.md)**

    ---

    [![anywidget-instruments-automotive cluster](img/automotives-dark.png#only-dark)](automotives.md)
    [![anywidget-instruments-automotive cluster](img/automotives-light.png#only-light)](automotives.md)

    The automotive instruments, bundled unmodified: speedometer, tachometer,
    fuel, coolant, tell-tales, gear indicator, cluster. For visualization
    only: no widget is meant to be operated while driving.

</div>

Other AFM modules can be loaded from a URL when the server allows it (see the
[User guide](guide.md#remote-modules)).

## Configure a panel

Choose a widget, set static traits, bind traits to the query results, a
dashboard variable or the time range (see the [User guide](guide.md)).

![The panel editor](img/editor.png#only-dark)
![The panel editor](img/editor-light.png#only-light)

## Documentation

- [User guide](guide.md): install, choose a widget, bind traits, write back.
- [anywidget-instruments-industrial](instruments.md) and
  [anywidget-instruments-automotive](automotives.md): the built-in widgets.
- [Compatibility and limits](compatibility.md): AFM compatibility matrix.
- [Design](design.md): how the host works and why.
- [Specification](specification.md): requirements (EARS, MoSCoW).
- [Development](development.md): build, tests, screenshots.

Screenshots are taken from the development server with
`node scripts/screenshots.mjs` (see [Development](development.md#screenshots)).

## Related projects

| Project | What it is | Documentation |
|---|---|---|
| [anywidget-instruments-industrial](https://github.com/AnywidgetInstruments/anywidget-instruments-industrial) | Instrumentation widgets for notebooks: gauges, tanks, LEDs, switches, charts, alarms, SCADA objects | <https://anywidgetinstruments.github.io/anywidget-instruments-industrial/> |
| [anywidget-instruments-automotive](https://github.com/AnywidgetInstruments/anywidget-instruments-automotive) | Automotive instruments built on anywidget-instruments | <https://anywidgetinstruments.github.io/anywidget-instruments-automotive/> |
| [afm-host-panel](https://github.com/AnywidgetInstruments/afm-host-panel) | Grafana panel plugin that runs anywidget modules, with both libraries built in | <https://anywidgetinstruments.github.io/afm-host-panel/> |
