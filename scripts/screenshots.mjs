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

// Options: `rows`, the title of a row and optionally of the next one, to keep
// only that part of the page (down to the last panel without a next row);
// `plugin: false` to leave the image out of src/img/screenshots/.
async function shoot(
  name,
  path,
  { theme = 'dark', width = 1600, height = 1500, widgets = DEMO_WIDGETS, rows, plugin = true } = {}
) {
  // A fixed locale: Grafana fails to start with some system locales (en-US@posix).
  const page = await browser.newPage({ viewport: { width, height }, locale: 'en-US' });
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
  let clip;
  if (rows) {
    const rowTop = async (row) => (await page.getByText(row, { exact: true }).first().boundingBox()).y - 8;
    const top = await rowTop(rows[0]);
    const bottom = rows[1]
      ? await rowTop(rows[1])
      : (await page.$$eval('[data-testid="afm-panel-host"]', (els) =>
          Math.max(...els.map((e) => e.closest('section')?.getBoundingClientRect().bottom ?? 0))
        )) + 8;
    clip = { x: 0, y: top, width, height: bottom - top };
  }
  await page.screenshot({ path: file, clip });
  if (plugin) {
    copyFileSync(file, join(PLUGIN, `${name}.png`));
  }
  await page.close();
  console.log(plugin ? `${file}, ${PLUGIN}/${name}.png` : file);
}

// The anywidget-instruments-industrial gallery dashboard.
const gallery = JSON.parse(readFileSync('provisioning/dashboards/instruments.json', 'utf8'));
const GALLERY_WIDGETS = gallery.panels.filter((p) => p.type === 'scelles-afmhost-panel').length;
const AERONAUTICS_ROW = demo.panels.find(
  (p) => p.type === 'row' && p.title.startsWith('anywidget-instruments-aeronautics')
).title;
const AUTOMOTIVE_ROW = demo.panels.find(
  (p) => p.type === 'row' && p.title.startsWith('anywidget-instruments-automotive')
).title;

try {
  for (const theme of ['dark', 'light']) {
    // The demonstration dashboard.
    await shoot(`demo-${theme}`, '/d/afm-host-demo?kiosk', { theme });
    // The anywidget-instruments-automotive cluster of the demonstration dashboard.
    await shoot(`automotives-${theme}`, '/d/afm-host-demo?kiosk', { theme, rows: [AUTOMOTIVE_ROW], plugin: false });
    // The anywidget-instruments-aeronautics row of the demonstration dashboard.
    await shoot(`aeronautics-${theme}`, '/d/afm-host-demo?kiosk', { theme, rows: [AERONAUTICS_ROW], plugin: false });
    // The anywidget-instruments-industrial gallery.
    await shoot(`instruments-${theme}`, '/d/afm-instruments-gallery?kiosk', {
      theme,
      height: 2400,
      widgets: GALLERY_WIDGETS,
      rows: ['Numeric indicators'],
      plugin: theme === 'dark',
    });
    // The panel editor: widget choice, static traits and trait bindings.
    await shoot(theme === 'dark' ? 'editor' : 'editor-light', '/d/afm-host-demo?editPanel=3', {
      theme,
      height: 1400,
      widgets: 1,
      plugin: theme === 'dark',
    });
  }
} finally {
  await browser.close();
}
