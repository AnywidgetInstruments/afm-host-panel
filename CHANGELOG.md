# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Development phases are `0.0.x` milestones, not releases (see `docs/roadmap.md`).

## [Unreleased]

### Added

- The flight instruments of anywidget-instruments-aeronautics (airspeed,
  attitude, altimeter, turn coordinator, heading, vertical speed), vendored
  unmodified at fb3a477 by `scripts/vendor-aeronautics.mjs`, each with its
  safety notice (INT-006); the demo dashboard shows them fed by TestData.

### Changed

- License: BSD 3-Clause (was MIT), as every repository of AnywidgetInstruments.

### Added

- The graphs of anywidget-instruments-industrial fed by messages draw the
  query results: `Sparkline`, `KPITile`, `TrendChart`, `WaveformChart` and
  `XYGraph` get a snapshot built from the data frames in answer to their
  `sync_request` and on every data change; pens, series and traces default
  to the number fields (MAP-011 .. MAP-013). The gallery dashboard shows them.

### Changed

- Both libraries now build on the anywidget-instruments core: industrial
  re-vendored at bb2484d (package renamed anywidget-instruments-industrial,
  vendored in `src/widgets/anywidget-instruments-industrial/`) and automotive
  at 7861fda, which no longer carries the industrial styles.
- The repositories moved to the AnywidgetInstruments organization: links,
  `plugin.json`, `package.json` and the vendoring scripts point there.
- Breaking: built-in widget ids follow the new library names, with no alias:
  `anywidget_instruments:*` becomes `anywidget_instruments_industrial:*` and
  `anywidget_automotives:*` becomes `anywidget_instruments_automotive:*`.
  Update the `widget` option of existing panels.
- The automotive entries are the widgets of anywidget-instruments-automotive,
  vendored unmodified by `scripts/vendor-automotive.mjs`, instead of previews
  drawn with industrial widgets; every one carries the safety notice (INT-005).
  The demo cluster reads the new `telltale` and `gear` variables.
- anywidget-instruments-industrial vendored at 978a890 and
  anywidget-instruments-automotive at dc2c98c.

### Fixed

- The anywidget-instruments widgets did not follow the Grafana theme (dark
  labels on a dark background): their entries now set `theme: "system"`,
  like the anywidget-automotives previews.

- `npm ci` failed on `main` after the Dependabot updates: `@grafana/*` 13.2
  requires React 19, TypeScript 7 and ESLint 10 are not supported by
  typescript-eslint and eslint-plugin-react. These return to `13.1.0`,
  `5.9.2` and `9.x` (ignored by Dependabot until supported); the other
  updates are kept, with `@emotion/css` 11.13.5 and Jest 30.
- End-to-end tests: run on Grafana OSS in CI, like the development server
  (the scaffold used Grafana Enterprise); console errors of Grafana itself
  (OpenFeature, public dashboards API of 12.3) are ignored; each panel's row
  is brought into view first, as Grafana 13.0 mounts the panels of a row only
  while the row is in view.

### Added

- `anywidget-instruments gallery` dashboard (`instruments.json`): 30
  anywidget-instruments widgets grouped by family, with an end-to-end test
  and screenshots; `docs/instruments.md` presents the built-in
  anywidget-instruments widgets.
- Documentation: light, dark or system theme (the default), screenshots
  that follow it, and the same "Related projects" section as
  anywidget-instruments and anywidget-automotives; `plugin.json` links to
  the documentation.
- Documentation published to GitHub Pages by the `Documentation` workflow
  (`just docs`, strict) on each push to `main`.
- User documentation with screenshots (README, guide, compatibility matrix,
  anywidget-automotives) and `scripts/screenshots.mjs` (`just screenshots`),
  which also fills the `screenshots` of `plugin.json` (DOC).
- End-to-end tests (`@grafana/plugin-e2e`) on the provisioned dashboards:
  every widget renders, gauge value, write-back to variables, time range,
  invalid module URL; `scripts/validator-summary.mjs` for the plugin
  validator report (QA).
- Provisioned dashboards (phase 5, `0.0.6`): `demo.json` (demonstration
  widgets, anywidget-instruments with write-back to a variable read by an
  LED, anywidget-automotives cluster preview) and `remote.json` (modules
  loaded from a URL); the development server allows remote modules
  (INT-001 .. INT-004).
- AFM host panel (`src/components/`, phase 4, `0.0.5`): built-in widget or
  module URL, trait bindings and static traits editors, size traits, shadow
  root or no isolation, diagnostics; traits pushed to the running widget on
  each render, restart when the source changes, clean up on removal, Grafana
  theme followed (PNL-001 .. PNL-007). Replaces the generated `SimplePanel`.
- Mapping of Grafana data to traits (`src/afm/mapping.ts`, phase 3, `0.0.4`):
  a field reduced by a Grafana reducer, all the values of a field, a static
  value, a dashboard variable (text, number or JSON) or the time range, with
  diagnostics for the sources without a value; routing of the traits saved by
  the widget to a dashboard variable or the panel options (MAP-001 .. MAP-009).
- Built-in widget registry (`src/afm/registry.ts`, phase 2, `0.0.3`), entries
  named `module:Class`: the three demonstration widgets, the 52
  anywidget-instruments widgets (vendored unmodified, loaded lazily through a
  blob: URL) and previews of six anywidget-automotives widgets drawn with
  anywidget-instruments (LOAD-005, INT-001, INT-002).
- Demonstration AFM widgets in `examples/`: counter (write-back), gauge
  (scalar) and sparkline (series, factory export) (INT-003).
- AFM loader (`src/afm/loader.ts`): default export as an object or a factory,
  validation with a clear error, `initialize` awaited before `render`, abort
  signals and cleanups on removal (views first, then the model), `host` and
  `experimental.invoke` rejecting with a descriptive error, remote modules
  limited to `https:` or the Grafana origin and gated by a server switch,
  widget container in a shadow root with its CSS and the Grafana theme
  (LOAD-001 .. LOAD-012).
- AFM model shim (`src/afm/model.ts`, phase 1, `0.0.2`): traits with
  structural change detection, `change:<trait>` and `change` events, changes
  sent to the host on `save_changes` only, `send` and `msg:custom` with
  `DataView` buffers, `off` in its three forms, `widget_manager.get_model`
  rejecting with a clear error (MOD-001 .. MOD-011).
- Panel plugin skeleton generated with `@grafana/create-plugin` 7.11.0
  (plugin ID `scelles-afmhost-panel`), MIT license.
- Development server on Grafana OSS 13.2.2 with a configurable host port
  (`GRAFANA_PORT`).
- Project governance: `AGENTS.md` rules, `SECURITY.md`, `CODE_OF_CONDUCT.md`
  (Contributor Covenant 3.0), `justfile`, `upstream-bugs.md`.
- Documentation site (MkDocs) with `llms.txt` and `llms-full.txt`: design,
  specification (EARS, MoSCoW) and roadmap (phase 0, `0.0.1`).

### Changed

- Single license file `LICENSE` (the identical `LICENSE.md` is removed).
- Documentation screenshots are taken once every widget has rendered,
  instead of after a fixed delay (the first one could show empty panels).
