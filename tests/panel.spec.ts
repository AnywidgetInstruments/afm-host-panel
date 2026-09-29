// End-to-end tests against the development server (docker compose), with the
// provisioned dashboards of provisioning/dashboards/.
import { expect, test } from '@grafana/plugin-e2e';

// Grafana interpolates the panel titles, and the panel selectors use the
// interpolated title: these are the default values of the demo variables.
const DEFAULT_VARIABLES: Record<string, string> = { $count: '0', $engine: 'false' };
const shownTitle = (title: string) => title.replace(/\$\w+/g, (v) => DEFAULT_VARIABLES[v] ?? v);

// Loading a widget (and the anywidget-instruments bundle) can be slow on a cold server.
const WIDGET_TIMEOUT = 30000;

// Console errors of Grafana itself, not of the plugin, by message or source URL:
// - the livereload client of `npm run dev`, injected by the development image,
//   which fails when webpack is not watching;
// - other plugins (grafana-assistant-app in the Enterprise images);
// - Grafana APIs missing or disabled on some versions (public dashboards,
//   user storage of the saved queries), and the OpenFeature (OFREP) feature
//   flag provider when its endpoint is not available.
const GRAFANA_NOISE = [
  /\/livereload\.js/,
  /\/(api|public)\/plugins\/(?!scelles-afmhost-panel\/)/,
  /\/api\/dashboards\/uid\/[^/]+\/public-dashboards/,
  /\/apis\/userstorage\.grafana\.app\//,
  /OpenFeature|OFREP/,
];

test('the demo dashboard renders every widget without console errors', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  // Every panel is brought into view in turn, each within WIDGET_TIMEOUT.
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('console', (msg) => {
    const text = `${msg.text()} ${msg.location().url}`;
    if (msg.type() === 'error' && !GRAFANA_NOISE.some((re) => re.test(text))) {
      errors.push(text);
    }
  });
  page.on('pageerror', (err) => errors.push(err.message));

  const dashboard = await readProvisionedDashboard({ fileName: 'demo.json' });
  const titles: string[] = (dashboard.panels ?? [])
    .filter((p: { type?: string }) => p.type === 'scelles-afmhost-panel')
    .map((p: { title: string }) => shownTitle(p.title));
  expect(titles.length).toBeGreaterThanOrEqual(13);

  const dashboardPage = await gotoDashboardPage(dashboard);
  // Panels are loaded lazily: bring each one into view, then wait for its widget.
  // Some Grafana versions (13.0) only mount the panels of a row once the row
  // is in view: scroll down until the panel exists.
  const viewport = page.viewportSize();
  await page.mouse.move((viewport?.width ?? 1280) / 2, (viewport?.height ?? 720) / 2);
  for (const title of titles) {
    const panel = dashboardPage.getPanelByTitle(title);
    for (let i = 0; i < 30 && (await panel.locator.count()) === 0; i++) {
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(200);
    }
    await panel.locator.scrollIntoViewIfNeeded();
    await expect(panel.locator.getByTestId('afm-panel-host'), title).toHaveAttribute('aria-busy', 'false', {
      timeout: WIDGET_TIMEOUT,
    });
  }
  await expect(page.getByTestId('afm-panel-error')).toHaveCount(0);
  expect(errors).toEqual([]);
});

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

test('an anywidget-instruments switch writes a variable read by an LED', async ({
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
