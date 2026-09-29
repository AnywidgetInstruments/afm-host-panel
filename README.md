# afm-host-panel

A Grafana panel plugin that hosts anywidget front-end modules (AFM). Widgets
written for Jupyter with [anywidget](https://anywidget.dev) run in Grafana
unchanged: the panel loads the module, gives it an element and a model, and
feeds the model from query results, the time range and dashboard variables.
A widget can write back to a dashboard variable.

Built in: three demonstration widgets, the 52 widgets of
[anywidget-instruments](https://github.com/s-celles/anywidget-instruments)
(gauges, tanks, LEDs, switches, seven-segment displays, ...) and previews of
[anywidget-automotives](https://github.com/s-celles/anywidget-automotives).
Other AFM modules can be loaded from a URL when the server allows it.

> **Status: initial development (0.0.x).** Not signed, not in the plugin
> catalog. Tested with Grafana OSS 13.2.2.

![The demonstration dashboard: example widgets, anywidget-instruments and an automotive cluster](docs/img/demo-dark.png)

The anywidget-instruments gallery dashboard: 30 of the 52 built-in
anywidget-instruments widgets.

![The anywidget-instruments gallery dashboard](docs/img/instruments-dark.png)

The panel editor: choose a widget, set static traits, bind traits to the
query results, a dashboard variable or the time range.

![The panel editor of the AFM host panel](docs/img/editor.png)

## Quick start

```bash
npm ci
npm run build
docker compose up -d        # GRAFANA_PORT=3001 docker compose up -d to change the port
```

Open <http://localhost:3000>, dashboard **AFM host demo**.

With [just](https://github.com/casey/just): `just install build server`,
`just check`, `just e2e`, `just docs`.

## Documentation

Published at <https://s-celles.github.io/afm-host-panel/>; `just docs` builds
it locally from `docs/`:

- [User guide](docs/guide.md): install, choose a widget, bind traits, write back
- [anywidget-instruments](docs/instruments.md): the 52 built-in instrumentation widgets
- [anywidget-automotives](docs/automotives.md): the automotive cluster preview
- [Compatibility and limits](docs/compatibility.md): AFM compatibility matrix
- [Design](docs/design.md), [Specification](docs/specification.md), [Roadmap](docs/roadmap.md)
- [Development](docs/development.md)

## Related projects

| Project | What it is | Documentation |
|---|---|---|
| [anywidget-instruments](https://github.com/s-celles/anywidget-instruments) | Instrumentation widgets for notebooks: gauges, tanks, LEDs, switches, charts, alarms, SCADA objects | <https://s-celles.github.io/anywidget-instruments/> |
| [anywidget-automotives](https://github.com/s-celles/anywidget-automotives) | Automotive instruments built on anywidget-instruments (design stage) | <https://s-celles.github.io/anywidget-automotives/> |
| [afm-host-panel](https://github.com/s-celles/afm-host-panel) | Grafana panel plugin that runs anywidget modules, with both libraries built in | <https://s-celles.github.io/afm-host-panel/> |

## License

MIT (see `LICENSE`). The vendored anywidget-instruments front end is
BSD-3-Clause (`src/widgets/anywidget-instruments/LICENSE`).

Contributing: `CODE_OF_CONDUCT.md`, `SECURITY.md`, `AGENTS.md`.
