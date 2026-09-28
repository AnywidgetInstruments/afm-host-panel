// Sparkline: an AFM widget drawing a series of values.
// Traits: values (array of numbers; null or non-numbers are gaps), label,
// unit, and the optional width / height traits (pixels).
// The widget factory form of the default export is used here on purpose:
// `export default () => ({ initialize, render })`.

const SVG = 'http://www.w3.org/2000/svg';

const STYLE = `
.afm-sparkline { display: flex; flex-direction: column; width: 100%; height: 100%; font-family: inherit; }
.afm-sparkline-head { display: flex; justify-content: space-between; gap: 1em; font-size: 0.9em; }
.afm-sparkline-last { font-variant-numeric: tabular-nums; font-weight: 600; }
.afm-sparkline svg { flex: 1; min-height: 20px; width: 100%; }
.afm-sparkline polyline { fill: none; stroke: #3d71d9; stroke-width: 2; vector-effect: non-scaling-stroke; }
`;

function numbers(value) {
  return Array.isArray(value) ? value.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)) : [];
}

/** Polylines of the finite runs of `values`, scaled into a 100 x 100 box. */
export function segments(values) {
  const finite = values.filter((v) => v !== null);
  if (finite.length === 0) {
    return [];
  }
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  const span = hi - lo || 1;
  const dx = values.length > 1 ? 100 / (values.length - 1) : 0;
  const runs = [];
  let run = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (run.length) {
        runs.push(run);
      }
      run = [];
      return;
    }
    run.push(`${(i * dx).toFixed(2)},${(100 - ((v - lo) / span) * 100).toFixed(2)}`);
  });
  if (run.length) {
    runs.push(run);
  }
  return runs.map((r) => r.join(' '));
}

function initialize({ model }) {
  // Nothing to share between views; present to show the initialize hook.
  if (!Array.isArray(model.get('values'))) {
    model.set('values', []);
  }
}

function render({ model, el }) {
  const style = document.createElement('style');
  style.textContent = STYLE;
  const root = document.createElement('div');
  root.className = 'afm-sparkline';
  const head = document.createElement('div');
  head.className = 'afm-sparkline-head';
  const label = document.createElement('span');
  const last = document.createElement('span');
  last.className = 'afm-sparkline-last';
  head.append(label, last);
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'img');
  root.append(head, svg);
  el.append(style, root);

  const update = () => {
    const values = numbers(model.get('values'));
    svg.replaceChildren(
      ...segments(values).map((points) => {
        const line = document.createElementNS(SVG, 'polyline');
        line.setAttribute('points', points);
        return line;
      })
    );
    const finite = values.filter((v) => v !== null);
    const unit = model.get('unit') ? ` ${model.get('unit')}` : '';
    last.textContent = finite.length ? `${Number(finite[finite.length - 1].toFixed(2))}${unit}` : '—';
    label.textContent = model.get('label') || '';
    svg.setAttribute(
      'aria-label',
      `${model.get('label') || 'Series'}: ${finite.length} values, last ${last.textContent}`
    );
    const w = Number(model.get('width'));
    const h = Number(model.get('height'));
    root.style.width = w > 0 ? `${w}px` : '100%';
    root.style.height = h > 0 ? `${h}px` : '100%';
  };

  const traits = ['values', 'label', 'unit', 'width', 'height'];
  traits.forEach((t) => model.on(`change:${t}`, update));
  update();
  return () => {
    traits.forEach((t) => model.off(`change:${t}`, update));
    style.remove();
    root.remove();
  };
}

export default () => ({ initialize, render });
