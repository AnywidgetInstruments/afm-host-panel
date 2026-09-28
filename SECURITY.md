# Security policy

## Supported versions

The project is in its initial development phase (`0.0.x`). Only the latest
commit of the `main` branch receives security fixes.

| Version | Supported |
|---|---|
| `main` (latest `0.0.x`) | yes |
| older commits | no |

## Reporting a vulnerability

Please do not open a public issue for a vulnerability.

Report it privately through a GitHub Security Advisory:
<https://github.com/s-celles/afm-host-panel/security/advisories/new>
(repository "Security" tab, then "Report a vulnerability").

Include the plugin version, the Grafana version, the browser, the steps to
reproduce and the impact you expect. You can expect a first answer within
7 days. Once a fix is available, the advisory is published with credit to the
reporter, unless you ask otherwise.

## Scope

The plugin runs JavaScript modules (AFM widgets) inside the Grafana front
end, with the rights of the logged-in user. In particular:

- Loading widgets from a URL (mode B) executes remote code. It is disabled by
  default; enabling it means trusting every URL a dashboard editor may enter.
- Built-in widgets (mode A) are bundled at build time and reviewed with the
  plugin.

Reports about these trust boundaries are welcome. The design choices are
described in `docs/design.md`.
