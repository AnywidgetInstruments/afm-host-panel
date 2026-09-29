// Take the documentation screenshots from the development server
// (`docker compose up`, provisioned dashboards) and write them to docs/img/
// (README and documentation site) and src/img/screenshots/ (plugin.json).
//
// Usage: node scripts/screenshots.mjs [grafana URL, default http://localhost:3000]
import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const base = (process.argv[2] ?? process.env.GRAFANA_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const DOCS = 'docs/img';
const PLUGIN = 'src/img/screenshots';
// Time for the widgets (and the anywidget-instruments bundle) to load and draw.
const SETTLE_MS = 8000;

mkdirSync(DOCS, { recursive: true });
mkdirSync(PLUGIN, { recursive: true });

const browser = await chromium.launch();

async function shoot(name, path, { theme = 'dark', width = 1600, height = 1150, clip } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  const sep = path.includes('?') ? '&' : '?';
  await page.goto(`${base}${path}${sep}theme=${theme}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(SETTLE_MS);
  const file = join(DOCS, `${name}.png`);
  if (clip) {
    await page.locator(clip).first().screenshot({ path: file });
  } else {
    await page.screenshot({ path: file });
  }
  copyFileSync(file, join(PLUGIN, `${name}.png`));
  await page.close();
  console.log(`${file}, ${PLUGIN}/${name}.png`);
}

try {
  // The demonstration dashboard, dark and light themes.
  await shoot('demo-dark', '/d/afm-host-demo?kiosk');
  await shoot('demo-light', '/d/afm-host-demo?kiosk', { theme: 'light' });
  // The panel editor: widget choice, static traits and trait bindings.
  await shoot('editor', '/d/afm-host-demo?editPanel=3', { width: 1600, height: 1400 });
} finally {
  await browser.close();
}
