import { resolveWidget } from './loader';
import { findWidget, importEsmText, listWidgets } from './registry';
import { INSTRUMENTS_KINDS } from '../widgets/anywidget-instruments/kinds';

describe('registry (LOAD-005, INT-001, INT-002)', () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  it('names every entry module:Class, with unique ids', () => {
    const ids = listWidgets().map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z_]+:[A-Za-z0-9]+$/));
  });

  it.each(['examples:Counter', 'examples:Gauge', 'examples:Sparkline'])(
    'loads the demonstration widget %s',
    async (id) => {
      const entry = findWidget(id)!;
      expect(entry).toBeDefined();
      const { module } = await entry.load();
      const def = await resolveWidget(module, id);
      expect(typeof def.render).toBe('function');
    }
  );

  it('lists every concrete anywidget-instruments widget with its _kind', () => {
    for (const [cls, kind] of Object.entries(INSTRUMENTS_KINDS)) {
      const entry = findWidget(`anywidget_instruments:${cls}`);
      expect(entry?.defaults._kind).toBe(kind);
    }
  });

  it('loads anywidget-instruments from its unmodified ESM text, with its CSS', async () => {
    // jsdom has no object URLs.
    URL.createObjectURL = jest.fn().mockReturnValue('blob:test/instruments');
    URL.revokeObjectURL = jest.fn();
    const importer = jest.fn().mockResolvedValue({ default: { render() {} } });
    const entry = findWidget('anywidget_instruments:Gauge')!;
    const first = await entry.load(importer);
    const second = await findWidget('anywidget_instruments:Tank')!.load(importer);
    expect(importer).toHaveBeenCalledTimes(1); // one module shared by all the widgets
    expect(importer.mock.calls[0][0]).toMatch(/^blob:/);
    expect(first.module).toBe(second.module);
    expect(first.css).toHaveLength(1);
    expect('text' in first.css[0] && first.css[0].text).toContain('.awi-root');
  });

  it('maps the anywidget-automotives previews to anywidget-instruments widgets', () => {
    const previews = listWidgets().filter((w) => w.id.startsWith('anywidget_automotives:'));
    expect(previews.map((w) => w.id)).toEqual(
      expect.arrayContaining([
        'anywidget_automotives:Speedometer',
        'anywidget_automotives:Tachometer',
        'anywidget_automotives:FuelGauge',
        'anywidget_automotives:TemperatureGauge',
        'anywidget_automotives:TellTale',
        'anywidget_automotives:TripComputer',
      ])
    );
    const kinds = new Set(Object.values(INSTRUMENTS_KINDS));
    for (const p of previews) {
      expect(p.preview).toBe(true);
      expect(kinds.has(p.defaults._kind as string)).toBe(true);
    }
    expect(findWidget('anywidget_automotives:Speedometer')!.defaults).toMatchObject({
      _kind: 'gauge',
      unit: 'km/h',
    });
  });

  it('returns undefined for an unknown id', () => {
    expect(findWidget('nope:Nothing')).toBeUndefined();
  });
});

describe('importEsmText', () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  it('imports the text through a blob URL and revokes it', async () => {
    URL.createObjectURL = jest.fn().mockReturnValue('blob:test/1');
    URL.revokeObjectURL = jest.fn();
    const importer = jest.fn().mockResolvedValue({ default: {} });
    await importEsmText('export default {}', importer);
    const blob: Blob = (URL.createObjectURL as jest.Mock).mock.calls[0][0];
    expect(blob.type).toBe('text/javascript');
    expect(importer).toHaveBeenCalledWith('blob:test/1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test/1');
  });

  it('revokes the URL when the import fails', async () => {
    URL.createObjectURL = jest.fn().mockReturnValue('blob:test/2');
    URL.revokeObjectURL = jest.fn();
    await expect(importEsmText('syntax error', jest.fn().mockRejectedValue(new SyntaxError('x')))).rejects.toThrow();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test/2');
  });
});
