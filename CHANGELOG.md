# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Development phases are `0.0.x` milestones, not releases (see `docs/roadmap.md`).

## [Unreleased]

### Added

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
