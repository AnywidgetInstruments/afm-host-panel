// Gauge: an AFM widget showing one scalar value on a 240° arc.
// Traits: value (number), min (default 0), max (default 100), unit, label,
// and the optional width / height traits (pixels) set by hosts that know the
// size of the widget area.

const SVG = 'http://www.w3.org/2000/svg';
const START = -210; // degrees, 0 = 3 o'clock, counterclockwise negative
const SWEEP = 240;

const STYLE = `
.afm-gauge { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.afm-gauge svg { max-width: 100%; max-height: 100%; }
.afm-gauge .track { stroke: currentColor; stroke-opacity: 0.2; }
.afm-gauge .bar { stroke: #3d71d9; }
.afm-gauge text { fill: currentColor; font-family: inherit; }
`;

function point(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arc(cx, cy, r, from, to) {
  const [x1, y1] = point(cx, cy, r, from);
  const [x2, y2] = point(cx, cy, r, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

function node(name, attrs) {
  const n = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) {
    n.setAttribute(k, String(v));
  }
  return n;
}

function render({ model, el }) {
  const style = document.createElement('style');
  style.textContent = STYLE;
  const root = document.createElement('div');
  root.className = 'afm-gauge';
  const svg = node('svg', { viewBox: '0 0 200 170', role: 'meter' });
  const track = node('path', { class: 'track', fill: 'none', 'stroke-width': 16, 'stroke-linecap': 'round' });
  const bar = node('path', { class: 'bar', fill: 'none', 'stroke-width': 16, 'stroke-linecap': 'round' });
  const text = node('text', { x: 100, y: 108, 'text-anchor': 'middle', 'font-size': 30 });
  const caption = node('text', { x: 100, y: 160, 'text-anchor': 'middle', 'font-size': 15, 'fill-opacity': 0.8 });
  track.setAttribute('d', arc(100, 100, 80, START, START + SWEEP));
  svg.append(track, bar, text, caption);
  root.append(svg);
  el.append(style, root);

  const num = (name, fallback) => {
    const v = Number(model.get(name));
    return Number.isFinite(v) ? v : fallback;
  };
  const update = () => {
    const min = num('min', 0);
    const max = num('max', 100);
    const v = model.get('value');
    // null, undefined and empty text are "no value", not 0.
    const raw = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    const valid = Number.isFinite(raw) && max > min;
    const ratio = valid ? Math.min(1, Math.max(0, (raw - min) / (max - min))) : 0;
    bar.setAttribute('d', ratio > 0 ? arc(100, 100, 80, START, START + SWEEP * ratio) : '');
    const unit = model.get('unit') ? ` ${model.get('unit')}` : '';
    text.textContent = valid ? `${Number(raw.toFixed(2))}${unit}` : '—';
    caption.textContent = model.get('label') || '';
    svg.setAttribute('aria-valuemin', String(min));
    svg.setAttribute('aria-valuemax', String(max));
    svg.setAttribute('aria-valuenow', valid ? String(raw) : '');
    svg.setAttribute('aria-label', model.get('label') || 'Gauge');
    const w = num('width', 0);
    const h = num('height', 0);
    root.style.height = h > 0 ? `${h}px` : '100%';
    root.style.width = w > 0 ? `${w}px` : '100%';
  };

  const traits = ['value', 'min', 'max', 'unit', 'label', 'width', 'height'];
  traits.forEach((t) => model.on(`change:${t}`, update));
  update();
  return () => {
    traits.forEach((t) => model.off(`change:${t}`, update));
    style.remove();
    root.remove();
  };
}

export default { render };
