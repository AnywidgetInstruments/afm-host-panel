// Summarize the JSON report of the Grafana plugin validator (just validate).
// Exits with 1 when the report has errors.
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? '.validate/report.json';
const text = readFileSync(file, 'utf8').trim();
if (!text) {
  console.error(`${file} is empty: the validator did not run (is Docker running?).`);
  process.exit(1);
}
const report = JSON.parse(text);

// Shape: { id, version, plugin-validator: { <analyzer>: [ { Severity, Title, Detail } ] } }
const results = report['plugin-validator'] ?? {};
const counts = { error: 0, warning: 0, recommendation: 0, ok: 0 };
for (const [analyzer, items] of Object.entries(results)) {
  for (const item of items ?? []) {
    const severity = String(item.Severity ?? '').toLowerCase();
    counts[severity] = (counts[severity] ?? 0) + 1;
    if (severity !== 'ok') {
      console.log(`[${severity}] ${analyzer}: ${item.Title}${item.Detail ? `\n    ${item.Detail}` : ''}`);
    }
  }
}
console.log(`\nerrors: ${counts.error}, warnings: ${counts.warning}, recommendations: ${counts.recommendation}`);
process.exit(counts.error > 0 ? 1 : 0);
