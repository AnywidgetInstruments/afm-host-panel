// Take the documentation screenshots from the development server
// (`docker compose up`, provisioned dashboards) and write them to docs/img/
// (README and documentation site) and src/img/screenshots/ (plugin.json).
//
// Usage: node scripts/screenshots.mjs [grafana URL, default http://localhost:3000]
import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const base = (process.argv[2] ?? process.env.GRAFANA_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const DOCS = 'docs/img';
const PLUGIN = 'src/img/screenshots';
// A cold server can take long to answer the queries and load the widget bundles.
const LOAD_TIMEOUT = 180000;
// Time for the widgets to finish their animations (needles) once rendered.
const SETTLE_MS = 2000;

// Number of AFM panels of the demonstration dashboard: all are in view in the
// screenshots, and each must have rendered its widget.
const demo = JSON.parse(readFileSync('provisioning/dashboards/demo.json', 'utf8'));
const DEMO_WIDGETS = demo.panels.filter((p) => p.type === 'scelles-afmhost-panel').length;

mkdirSync(DOCS, { recursive: true });
mkdirSync(PLUGIN, { recursive: true });

const browser = await chromium.launch();

async function shoot(name, path, { theme = 'dark', width = 1600, height = 1150, widgets = DEMO_WIDGETS } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  const sep = path.includes('?') ? '&' : '?';
  await page.goto(`${base}${path}${sep}theme=${theme}`, { waitUntil: 'load', timeout: LOAD_TIMEOUT });
  // Wait until every widget in view is rendered (the panel clears aria-busy),
  // with no panel error, rather than for a fixed time.
  await page.waitForFunction(
    (n) => document.querySelectorAll('[data-testid="afm-panel-host"][aria-busy="false"]').length >= n,
    widgets,
    { timeout: LOAD_TIMEOUT, polling: 500 }
  );
  const errors = await page.getByTestId('afm-panel-error').count();
  if (errors > 0) {
    throw new Error(`${name}: ${errors} panel(s) show a widget error`);
  }
  await page.waitForLoadState('networkidle', { timeout: LOAD_TIMEOUT }).catch(() => undefined);
  await page.waitForTimeout(SETTLE_MS);
  const file = join(DOCS, `${name}.png`);
  await page.screenshot({ path: file });
  copyFileSync(file, join(PLUGIN, `${name}.png`));
  await page.close();
  console.log(`${file}, ${PLUGIN}/${name}.png`);
}

try {
  // The demonstration dashboard, dark and light themes.
  await shoot('demo-dark', '/d/afm-host-demo?kiosk');
  await shoot('demo-light', '/d/afm-host-demo?kiosk', { theme: 'light' });
  // The panel editor: widget choice, static traits and trait bindings.
  await shoot('editor', '/d/afm-host-demo?editPanel=3', { height: 1400, widgets: 1 });
} finally {
  await browser.close();
}
