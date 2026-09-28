# Upstream bugs

Bugs and limitations found in dependencies while developing this plugin.
Each entry gives the versions needed to reproduce it.

| Date | Component | Versions | Summary | Workaround | Status |
|---|---|---|---|---|---|
| 2026-09-28 | `@grafana/create-plugin` | 7.11.0, Node 26.8.1, Windows 11 (10.0.26200) | The CLI stops with "Create plugin does not support Windows. Please use WSL." | Scaffold from WSL (Ubuntu) with Node 22 (`npx -p node@22`), then copy the files. | Documented limitation |
