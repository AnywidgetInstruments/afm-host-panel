# Development

## Requirements

- Node.js 22 or later, npm.
- Docker (development server, plugin validator).
- [just](https://github.com/casey/just), [uv](https://docs.astral.sh/uv/)
  (documentation).
- On Windows, `@grafana/create-plugin` itself does not run (see
  `upstream-bugs.md`); the generated project builds and tests on Windows.

## Commands

| Command | Does |
|---|---|
| `just install` | `npm ci` |
| `just check` | type check, lint, unit and component tests |
| `just build` | production bundle in `dist/` |
| `just server` | Grafana OSS 13.2.2 with the plugin and the provisioned dashboards; `GRAFANA_PORT=3001 just server` to use another port |
| `just e2e` | Playwright tests against the running server (`GRAFANA_PORT` as above) |
| `just docs` | documentation in `site/`, strict, with `llms.txt` and `llms-full.txt`; published to <https://s-celles.github.io/afm-host-panel/> by the `Documentation` workflow on each push to `main` |
| `just validate` | Grafana plugin validator (Docker) on a packaged `dist/` |

If your npm configuration sets `os` to another platform, platform packages
such as `@swc/core-win32-x64-msvc` are skipped; install with
`npm ci --os=<your platform>`.

## Layout

See `AGENTS.md`. The AFM host core is in `src/afm/` and has no React
dependency; `src/components/` holds the panel and its option editors.

## Tests

- `src/**/*.test.ts(x)`: Jest (jsdom), including Testing Library tests of the
  panel with a spy widget.
- `tests/*.spec.ts`: Playwright with `@grafana/plugin-e2e`, against the
  provisioned dashboards `demo.json` and `remote.json`. Start the server with
  `just server` first.

Write the test first (TDD). Each requirement of the
[specification](specification.md) is named in the test titles.

## Screenshots

With the development server running (`just server`):

```bash
node scripts/screenshots.mjs            # or: node scripts/screenshots.mjs http://localhost:3001
```

The script writes the images to `docs/img/` (README and documentation site)
and `src/img/screenshots/` (`screenshots` of `plugin.json`, shown in the
plugin catalog). Take them again when the demonstration dashboard or the
panel editor changes.

## Updating anywidget-instruments

```bash
cd ../anywidget-instruments && npm ci && npm run build && cd -
node scripts/vendor-instruments.mjs ../anywidget-instruments
```

The script copies the built module and CSS unmodified, with the upstream
license and commit (`src/widgets/anywidget-instruments/SOURCE.json`).
Commit the result with the commit hash in the message.

## Releases

The project follows Semantic Versioning. Development phases are `0.0.x`
milestones (see [Roadmap](roadmap.md)). Record every notable change in
`CHANGELOG.md`.
