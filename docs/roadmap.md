# Roadmap

Development phases are `0.0.x` milestones, not releases: phase 0 is `0.0.1`,
phase 1 is `0.0.2`, and so on. The version in `package.json` gives the last
phase reached.

| Phase | Version | Content | Requirements |
|---|---|---|---|
| 0 | 0.0.1 | Skeleton, governance, design, specification | |
| 1 | 0.0.2 | Model shim | MOD |
| 2 | 0.0.3 | Loader, built-in registry, remote loading | LOAD |
| 3 | 0.0.4 | Mapping of Grafana data to traits and write-back | MAP |
| 4 | 0.0.5 | Panel component and options editor | PNL |
| 5 | 0.0.6 | Demonstration widgets, anywidget-instruments and anywidget-automotives integration, provisioned dashboards | INT |
| 6 | 0.0.7 | End-to-end tests, plugin validator, user documentation | QA, DOC |

After phase 6: answering `sync_request` from data frames for the graphs of
anywidget-instruments, and testing under the frontend sandbox and a strict CSP.
