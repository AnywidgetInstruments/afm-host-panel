# Main entry points of afm-host-panel. Run `just` to list the recipes.

set shell := ["bash", "-euo", "pipefail", "-c"]
set windows-shell := ["bash", "-euo", "pipefail", "-c"]

plugin_id := "scelles-afmhost-panel"
grafana_port := env("GRAFANA_PORT", "3000")
# Documentation toolchain, pinned for reproducible builds.
docs_deps := "--with mkdocs-material==9.7.7 --with mkdocs-llmstxt==0.5.0"
# The theme prints a notice about MkDocs 2.0 on each build; it is not a build warning.
export NO_MKDOCS_2_WARNING := "1"

default:
    @just --list

# Install the npm dependencies from the lockfile.
install:
    npm ci

# Unit and component tests (Jest).
test:
    npm run test:ci

# Type check, lint and unit tests.
check: typecheck lint test

# TypeScript type check.
typecheck:
    npm run typecheck

# ESLint.
lint:
    npm run lint

# Production bundle in dist/.
build:
    npm run build

# Development bundle, rebuilt on change.
dev:
    npm run dev

# Grafana development server (Docker); GRAFANA_PORT sets the host port (default 3000).
server:
    GRAFANA_PORT={{grafana_port}} docker compose up -d --build
    @echo "Grafana: http://localhost:{{grafana_port}}"

# Stop the development server.
server-down:
    docker compose down

# End-to-end tests against the running development server.
e2e:
    GRAFANA_URL=http://localhost:{{grafana_port}} npm run e2e

# Documentation screenshots (docs/img/, src/img/screenshots/) from the running development server.
screenshots:
    node scripts/screenshots.mjs http://localhost:{{grafana_port}}

# Documentation (strict: warnings fail), with llms.txt and llms-full.txt in site/.
docs:
    uvx --from mkdocs==1.6.1 {{docs_deps}} mkdocs build --strict
    test -f site/llms.txt && test -f site/llms-full.txt

# Serve the documentation with live reload.
docs-serve:
    uvx --from mkdocs==1.6.1 {{docs_deps}} mkdocs serve

# Package dist/ as a plugin archive and run the Grafana plugin validator (Docker).
validate: build
    rm -rf .validate && mkdir -p .validate && cp -r dist .validate/{{plugin_id}}
    cd .validate && uv run --no-project python -m zipfile -c {{plugin_id}}.zip {{plugin_id}}
    docker run --rm --pull=always -v "$(pwd)/.validate/{{plugin_id}}.zip:/archive.zip:ro" grafana/plugin-validator-cli -jsonOutput /archive.zip > .validate/report.json || true
    node scripts/validator-summary.mjs .validate/report.json
