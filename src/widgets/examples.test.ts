// The demonstration widgets of examples/, run on the model shim (INT-003).
import counter from '../../examples/counter.js';
import gauge from '../../examples/gauge.js';
import sparkline, { segments } from '../../examples/sparkline.js';
import { resolveWidget, startWidget } from '../afm/loader';
import { AfmModel } from '../afm/model';

async function mount(mod: unknown, traits: Record<string, unknown>, onSave = jest.fn()) {
  const model = new AfmModel(traits, { onSave });
  const widget = await startWidget(await resolveWidget({ default: mod }, 'example'), model);
  const el = document.createElement('div');
  document.body.append(el);
  await widget.render(el);
  return { model, widget, el, onSave };
}

describe('examples/counter.js', () => {
  it('adds the step on click and saves the value', async () => {
    const { el, model, onSave } = await mount(counter, { value: 2, step: 3, label: 'Clicks' });
    expect(el.textContent).toContain('Clicks');
    el.querySelector('button')!.click();
    expect(model.get('value')).toBe(5);
    expect(onSave).toHaveBeenCalledWith({ value: 5 });
    expect(el.querySelector('[role="status"]')!.textContent).toBe('5');
  });

  it('shows host updates and removes its listeners on cleanup', async () => {
    const { el, model, widget } = await mount(counter, { value: 0 });
    model.update({ value: 42 });
    expect(el.querySelector('[role="status"]')!.textContent).toBe('42');
    await widget.destroy();
    expect(model.listenerCount()).toBe(0);
    expect(el.childNodes).toHaveLength(0);
  });
});

describe('examples/gauge.js', () => {
  it('shows the value with its unit and the ARIA range', async () => {
    const { el, model } = await mount(gauge, { value: 25, min: 0, max: 50, unit: 'km/h', label: 'Speed' });
    const svg = el.querySelector('svg')!;
    expect(svg.getAttribute('aria-valuenow')).toBe('25');
    expect(svg.textContent).toContain('25 km/h');
    model.update({ value: 30.456 });
    expect(svg.textContent).toContain('30.46 km/h');
  });

  it('shows a dash for a missing value', async () => {
    const { el } = await mount(gauge, { value: null });
    expect(el.querySelector('svg')!.textContent).toContain('—');
  });

  it('applies the width and height traits', async () => {
    const { el, model } = await mount(gauge, { value: 1, width: 300, height: 200 });
    const root = el.querySelector('.afm-gauge') as HTMLElement;
    expect(root.style.width).toBe('300px');
    model.update({ height: 120 });
    expect(root.style.height).toBe('120px');
  });
});

describe('examples/sparkline.js', () => {
  it('uses the factory form and initializes a missing series', async () => {
    const { model } = await mount(sparkline, {});
    expect(model.get('values')).toEqual([]);
  });

  it('draws one line per run of values, with gaps for null', async () => {
    const { el, model } = await mount(sparkline, { values: [1, 2, null, 4, 5], unit: 'V' });
    expect(el.querySelectorAll('polyline')).toHaveLength(2);
    expect(el.querySelector('.afm-sparkline-last')!.textContent).toBe('5 V');
    model.update({ values: [3] });
    expect(el.querySelectorAll('polyline')).toHaveLength(1);
  });

  it('scales values into the box', () => {
    expect(segments([0, 10])).toEqual(['0.00,100.00 100.00,0.00']);
    expect(segments([null])).toEqual([]);
  });
});
