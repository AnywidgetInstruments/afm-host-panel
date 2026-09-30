import { resolveWidget } from './loader';
import { AUTOMOTIVE_SAFETY_NOTICE, findWidget, importEsmText, listWidgets } from './registry';
import { INSTRUMENTS_KINDS } from '../widgets/anywidget-instruments-industrial/kinds';
import { AUTOMOTIVE_KINDS } from '../widgets/anywidget-instruments-automotive/kinds';

describe('registry (LOAD-005, INT-001, INT-002, INT-005)', () => {
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
      const entry = findWidget(`anywidget_instruments_industrial:${cls}`);
      expect(entry?.defaults._kind).toBe(kind);
    }
  });

  it('makes the anywidget-instruments widgets follow the Grafana theme', () => {
    // "system": the widget reads the data-theme of the panel container; the
    // default "auto" lets the widget style decide, whatever the Grafana theme.
    for (const cls of Object.keys(INSTRUMENTS_KINDS)) {
      expect(findWidget(`anywidget_instruments_industrial:${cls}`)?.defaults.theme).toBe('system');
    }
  });

  it('loads anywidget-instruments from its unmodified ESM text, with its CSS', async () => {
    // jsdom has no object URLs.
    URL.createObjectURL = jest.fn().mockReturnValue('blob:test/instruments');
    URL.revokeObjectURL = jest.fn();
    const importer = jest.fn().mockResolvedValue({ default: { render() {} } });
    const entry = findWidget('anywidget_instruments_industrial:Gauge')!;
    const first = await entry.load(importer);
    const second = await findWidget('anywidget_instruments_industrial:Tank')!.load(importer);
    expect(importer).toHaveBeenCalledTimes(1); // one module shared by all the widgets
    expect(importer.mock.calls[0][0]).toMatch(/^blob:/);
    expect(first.module).toBe(second.module);
    expect(first.css).toHaveLength(1);
    expect('text' in first.css[0] && first.css[0].text).toContain('.awi-root');
  });

  it('lists every concrete anywidget-instruments-automotive widget with its _kind', () => {
    expect(Object.keys(AUTOMOTIVE_KINDS)).toEqual(
      expect.arrayContaining(['Cluster', 'Speedometer', 'Tachometer', 'FuelGauge', 'TellTale', 'TripComputer'])
    );
    for (const [cls, kind] of Object.entries(AUTOMOTIVE_KINDS)) {
      const entry = findWidget(`anywidget_instruments_automotive:${cls}`);
      expect(entry?.defaults).toEqual({ _kind: kind, theme: 'system' });
    }
  });

  it('carries the safety notice with every automotive widget', () => {
    const automotive = listWidgets().filter((w) => w.id.startsWith('anywidget_instruments_automotive:'));
    expect(automotive).toHaveLength(Object.keys(AUTOMOTIVE_KINDS).length);
    for (const w of automotive) {
      expect(w.description).toContain(AUTOMOTIVE_SAFETY_NOTICE);
    }
    expect(AUTOMOTIVE_SAFETY_NOTICE).toMatch(/operated while driving/);
  });

  it('loads anywidget-instruments-automotive from its own unmodified ESM text, with its CSS', async () => {
    URL.createObjectURL = jest.fn().mockReturnValue('blob:test/automotive');
    URL.revokeObjectURL = jest.fn();
    const importer = jest.fn().mockResolvedValue({ default: { render() {} } });
    const first = await findWidget('anywidget_instruments_automotive:Speedometer')!.load(importer);
    const second = await findWidget('anywidget_instruments_automotive:TellTale')!.load(importer);
    expect(importer).toHaveBeenCalledTimes(1);
    expect(first.module).toBe(second.module);
    const css = 'text' in first.css[0] ? first.css[0].text : '';
    expect(css).toContain('.awa-root');
    expect(css).toContain('.awi-root'); // the base styles come with the module
  });

  it('keeps no entry under the former names', () => {
    const ids = listWidgets().map((w) => w.id);
    expect(ids.filter((id) => /^anywidget_(instruments|automotives):/.test(id))).toEqual([]);
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
