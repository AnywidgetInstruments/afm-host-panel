// End-to-end tests against the development server (docker compose), with the
// provisioned dashboards of provisioning/dashboards/.
import { expect, test } from '@grafana/plugin-e2e';

// Grafana interpolates the panel titles, and the panel selectors use the
// interpolated title: these are the default values of the demo variables.
const DEFAULT_VARIABLES: Record<string, string> = { $count: '0', $engine: 'false', $telltale: 'on', $gear: 'D' };
const shownTitle = (title: string) => title.replace(/\$\w+/g, (v) => DEFAULT_VARIABLES[v] ?? v);

// Loading a widget (and the anywidget-instruments bundles) can be slow on a cold server.
const WIDGET_TIMEOUT = 30000;

// Console errors of Grafana itself, not of the plugin, by message or source URL:
// - the livereload client of `npm run dev`, injected by the development image,
//   which fails when webpack is not watching;
// - the OpenFeature (OFREP) feature flag provider, when its endpoint is not
//   available;
// - the public dashboards API, missing on Grafana 12.3.
const GRAFANA_NOISE = [/\/livereload\.js/, /OpenFeature|OFREP/, /\/api\/dashboards\/uid\/[^/]+\/public-dashboards/];

// The provisioned dashboards, with their minimum number of AFM panels.
const DASHBOARDS = [
  { name: 'the demo dashboard', fileName: 'demo.json', widgets: 19 },
  { name: 'the anywidget-instruments-industrial gallery', fileName: 'instruments.json', widgets: 34 },
];

for (const { name, fileName, widgets } of DASHBOARDS) {
  test(`${name} renders every widget without console errors`, async ({
    gotoDashboardPage,
    readProvisionedDashboard,
    page,
  }) => {
    // Every panel is brought into view in turn, each within WIDGET_TIMEOUT.
    test.setTimeout(240000);
    const errors: string[] = [];
    page.on('console', (msg) => {
      const text = `${msg.text()} ${msg.location().url}`;
      if (msg.type() === 'error' && !GRAFANA_NOISE.some((re) => re.test(text))) {
        errors.push(text);
      }
    });
    page.on('pageerror', (err) => errors.push(err.message));

    const dashboard = await readProvisionedDashboard({ fileName });
    // Each AFM panel with the title of the row it belongs to.
    const panels: Array<{ title: string; row?: string }> = [];
    let row: string | undefined;
    for (const p of (dashboard.panels ?? []) as Array<{ type?: string; title: string }>) {
      if (p.type === 'row') {
        row = p.title;
      } else if (p.type === 'scelles-afmhost-panel') {
        panels.push({ title: shownTitle(p.title), row });
      }
    }
    expect(panels.length).toBeGreaterThanOrEqual(widgets);

    const dashboardPage = await gotoDashboardPage(dashboard);
    // Panels are loaded lazily: bring each one into view, then wait for its widget.
    // Grafana 13.0 mounts the panels of a row only while the row is in view:
    // bring the row header into view first (rows are always mounted).
    for (const { title, row } of panels) {
      const panel = dashboardPage.getPanelByTitle(title);
      // Grafana can re-render a row or a panel while it scrolls: retry.
      await expect(async () => {
        if (row) {
          await page.getByText(row, { exact: true }).first().scrollIntoViewIfNeeded({ timeout: 2000 });
        }
        await panel.locator.scrollIntoViewIfNeeded({ timeout: 2000 });
      }, title).toPass({ timeout: WIDGET_TIMEOUT });
      await expect(panel.locator.getByTestId('afm-panel-host'), title).toHaveAttribute('aria-busy', 'false', {
        timeout: WIDGET_TIMEOUT,
      });
    }
    await expect(page.getByTestId('afm-panel-error')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('the gauge shows the last TestData value', async ({ gotoDashboardPage, readProvisionedDashboard }) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'demo.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  const meter = dashboardPage.getPanelByTitle('Gauge (last TestData value)').locator.getByRole('meter');
  // TestData csv_metric_values "10,20,30,55": the last non-null value is 55.
  await expect(meter).toHaveAttribute('aria-valuenow', '55', { timeout: WIDGET_TIMEOUT });
  await expect(meter).toContainText('55 %');
});

test('a click on the counter updates the dashboard variable', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'demo.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  const counter = dashboardPage.getPanelByTitle(shownTitle('Counter (write-back to $count)'));
  await counter.locator.getByRole('button', { name: /Add 1/ }).click({ timeout: WIDGET_TIMEOUT });
  await expect(page).toHaveURL(/[?&]var-count=1(&|$)/);
  // The title follows the variable too.
  const updated = dashboardPage.getPanelByTitle('Counter (write-back to 1)');
  await expect(updated.locator.getByRole('status')).toHaveText('1');
  await expect(dashboardPage.getPanelByTitle('Dashboard variable').locator).toContainText('count = 1');
});

test('an anywidget-instruments-industrial switch writes a variable read by an LED', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'demo.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  const toggle = dashboardPage.getPanelByTitle(shownTitle('ToggleSwitch (write-back to $engine)'));
  await toggle.locator.scrollIntoViewIfNeeded();
  const sw = toggle.locator.getByRole('switch');
  await expect(sw).toHaveAttribute('aria-checked', 'false', { timeout: WIDGET_TIMEOUT });
  await sw.click();
  await expect(page).toHaveURL(/[?&]var-engine=true(&|$)/);
  const updated = dashboardPage.getPanelByTitle('ToggleSwitch (write-back to true)');
  await expect(updated.locator.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await expect(dashboardPage.getPanelByTitle('LED (reads true)').locator).toBeVisible();
});

test('the anywidget-instruments-automotive widgets come from their own module', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'demo.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  const row = (dashboard.panels as Array<{ type?: string; title: string }>).find(
    (p) => p.type === 'row' && p.title.startsWith('anywidget-instruments-automotive')
  )!;
  const gear = dashboardPage.getPanelByTitle(shownTitle('Gear ($gear)'));
  // The last row: Grafana 12 mounts a row only once the page has scrolled near
  // it, Grafana 13 its panels only while the row header is in view.
  test.setTimeout(120000);
  await expect(async () => {
    await page.mouse.wheel(0, 600);
    await page.getByText(row.title, { exact: true }).first().scrollIntoViewIfNeeded({ timeout: 2000 });
    await gear.locator.scrollIntoViewIfNeeded({ timeout: 2000 });
  }).toPass({ timeout: WIDGET_TIMEOUT });
  // Drawn by the automotive views (.awa-root), not by industrial stand-ins.
  await expect(gear.locator.locator('.awa-root').first()).toBeVisible({ timeout: WIDGET_TIMEOUT });
  await expect(gear.locator).toContainText('D');
  // Panels set only some traits: the others take their defaults, not an invalid state.
  for (const title of ['Speedometer', 'Fuel', 'Coolant']) {
    const panel = dashboardPage.getPanelByTitle(title);
    await expect(panel.locator.locator('.awa-root').first(), title).toBeVisible({ timeout: WIDGET_TIMEOUT });
    await expect(panel.locator.locator('.awa-root.awa-invalid'), title).toHaveCount(0);
  }
});

test('the graphs of anywidget-instruments-industrial draw the query results (MAP-011)', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  test.setTimeout(120000);
  const dashboard = await readProvisionedDashboard({ fileName: 'instruments.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  const sparkline = dashboardPage.getPanelByTitle('Sparkline');
  await expect(async () => {
    await page.mouse.wheel(0, 800);
    await page.getByText('Graphs fed by the query', { exact: true }).first().scrollIntoViewIfNeeded({ timeout: 2000 });
    await sparkline.locator.scrollIntoViewIfNeeded({ timeout: 2000 });
  }).toPass({ timeout: WIDGET_TIMEOUT });
  // The value of a Sparkline is the last of the history the panel sent: no binding sets it.
  await expect(sparkline.locator).toContainText(/\d+\.\d+ m³\/h/, { timeout: WIDGET_TIMEOUT });
});

test('a time range change reaches the widget traits', async ({ gotoDashboardPage, readProvisionedDashboard }) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'demo.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  await dashboardPage.timeRange.set({
    from: '2026-01-01 00:00:00',
    to: '2026-01-01 06:00:00',
    zone: 'Coordinated Universal Time',
  });
  const sparkline = dashboardPage.getPanelByTitle('Sparkline (series, label = time range start)');
  // The label trait is bound to the start of the time range, as ISO 8601 text.
  await expect(sparkline.locator).toContainText('2026-01-01T00:00:00.000Z', { timeout: WIDGET_TIMEOUT });
});

test('mode B: an invalid module URL shows an error in the panel, not a crash', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'remote.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  const panel = dashboardPage.getPanelByTitle('Invalid module URL');
  await expect(panel.locator.getByTestId('afm-panel-error')).toContainText('Cannot load the module', {
    timeout: WIDGET_TIMEOUT,
  });
  await expect(dashboardPage.getPanelByTitle('About this dashboard').locator).toBeVisible();
});
