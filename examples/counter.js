// Counter: an AFM widget that writes back to its host.
// Traits: value (number), step (number, default 1), label (string).
// A click adds `step` to `value` and saves it (model.save_changes), which is
// how a widget reports an operator action to a Jupyter kernel or to Grafana.

const STYLE = `
.afm-counter { display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.5em; height: 100%; font-family: inherit; color: inherit; }
.afm-counter-label { font-size: 0.9em; opacity: 0.8; }
.afm-counter-value { font-size: 2.2em; font-variant-numeric: tabular-nums; }
.afm-counter button { font: inherit; padding: 0.3em 1.2em; border-radius: 4px; cursor: pointer;
  border: 1px solid currentColor; background: transparent; color: inherit; }
.afm-counter button:focus-visible { outline: 2px solid #3d71d9; outline-offset: 2px; }
`;

function render({ model, el }) {
  const style = document.createElement('style');
  style.textContent = STYLE;
  const root = document.createElement('div');
  root.className = 'afm-counter';
  const label = document.createElement('div');
  label.className = 'afm-counter-label';
  const value = document.createElement('div');
  value.className = 'afm-counter-value';
  value.setAttribute('role', 'status');
  const button = document.createElement('button');
  button.type = 'button';
  root.append(label, value, button);
  el.append(style, root);

  const step = () => {
    const s = Number(model.get('step'));
    return Number.isFinite(s) && s !== 0 ? s : 1;
  };
  const update = () => {
    const v = Number(model.get('value'));
    value.textContent = Number.isFinite(v) ? String(v) : '0';
    label.textContent = model.get('label') || 'Counter';
    button.textContent = `+${step()}`;
    button.setAttribute('aria-label', `Add ${step()} to ${label.textContent}`);
  };
  const onClick = () => {
    const v = Number(model.get('value'));
    model.set('value', (Number.isFinite(v) ? v : 0) + step());
    model.save_changes();
  };

  button.addEventListener('click', onClick);
  model.on('change:value', update);
  model.on('change:step', update);
  model.on('change:label', update);
  update();

  return () => {
    button.removeEventListener('click', onClick);
    model.off('change:value', update);
    model.off('change:step', update);
    model.off('change:label', update);
    style.remove();
    root.remove();
  };
}

export default { render };
