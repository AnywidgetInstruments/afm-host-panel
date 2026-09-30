import { FieldType, toDataFrame } from '@grafana/data';
import { derivedTraits, isMessageKind, seriesMessage } from './series';

const frame = toDataFrame({
  refId: 'A',
  fields: [
    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
    { name: 'level', type: FieldType.number, values: [1, 2, 3, 4] },
    { name: 'flow', type: FieldType.number, values: [10, 20, 30, 40] },
  ],
});

const f32 = (b: ArrayBufferView) => Array.from(b as Float32Array);
const f64 = (b: ArrayBufferView) => Array.from(b as Float64Array);

describe('series messages (MAP-011)', () => {
  it('knows the graphs fed by messages', () => {
    expect(['sparkline', 'kpitile', 'trendchart', 'waveformchart', 'xygraph'].every(isMessageKind)).toBe(true);
    expect(isMessageKind('gauge')).toBe(false);
    expect(seriesMessage('gauge', [frame], {})).toBeUndefined();
  });

  it('sends nothing without a number field', () => {
    const empty = toDataFrame({ fields: [{ name: 'time', type: FieldType.time, values: [1] }] });
    expect(seriesMessage('sparkline', [empty], {})).toBeUndefined();
    expect(derivedTraits('trendchart', [empty], {})).toEqual({});
  });

  it('gives a Sparkline or a KPITile the last `history` values of the first number field', () => {
    for (const kind of ['sparkline', 'kpitile']) {
      const m = seriesMessage(kind, [frame], { history: 3 })!;
      expect(m.content).toEqual({ type: 'snapshot', n: 3 });
      expect(m.buffers[0]).toBeInstanceOf(Float32Array);
      expect(f32(m.buffers[0])).toEqual([2, 3, 4]);
    }
  });

  it('gives each pen of a TrendChart its times in Unix seconds and its values, matched by name', () => {
    const m = seriesMessage('trendchart', [frame], { pens: [{ name: 'flow' }, { name: 'level' }] })!;
    expect(m.content).toEqual({
      type: 'snapshot',
      pens: [
        [1, 4, 4],
        [0, 4, 4],
      ],
    });
    expect(m.buffers[0]).toBeInstanceOf(Float64Array);
    expect(f64(m.buffers[0])).toEqual([1, 2, 3, 4]);
    expect(f32(m.buffers[1])).toEqual([1, 2, 3, 4]); // level, pen 1
    expect(f32(m.buffers[3])).toEqual([10, 20, 30, 40]); // flow, pen 0
  });

  it('matches the pens of a TrendChart by order when the names differ, and drops fields beyond the pens', () => {
    const m = seriesMessage('trendchart', [frame], { pens: [{ name: 'A' }], history: 2 })!;
    expect(m.content).toEqual({ type: 'snapshot', pens: [[0, 2, 2]] });
    expect(f64(m.buffers[0])).toEqual([3, 4]);
    expect(seriesMessage('trendchart', [frame], { pens: [] })).toBeUndefined();
  });

  it('gives a WaveformChart one row per point and one column per trace', () => {
    const m = seriesMessage('waveformchart', [frame], { n_traces: 2, history: 3 })!;
    expect(m.content).toEqual({ type: 'snapshot', n_points: 3, total: 3 });
    expect(f32(m.buffers[0])).toEqual([2, 20, 3, 30, 4, 40]);
  });

  it('gives an XYGraph the first number field as x and one set per other field', () => {
    const m = seriesMessage('xygraph', [frame], { series: [{ name: 'flow' }] })!;
    expect(m.content).toEqual({ type: 'data', clear: true, sets: [['flow', 4]] });
    expect(f64(m.buffers[0])).toEqual([1, 2, 3, 4]);
    expect(f64(m.buffers[1])).toEqual([10, 20, 30, 40]);
  });

  it('uses the time as the x of an XYGraph with a single number field', () => {
    const one = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000] },
        { name: 'v', type: FieldType.number, values: [5, 6] },
      ],
    });
    const m = seriesMessage('xygraph', [one], {})!;
    expect(m.content).toEqual({ type: 'data', clear: true, sets: [['v', 2]] });
    expect(f64(m.buffers[0])).toEqual([1, 2]);
  });
});

describe('derived traits (MAP-013)', () => {
  it('names the pens of a TrendChart after the fields when none are set', () => {
    expect(derivedTraits('trendchart', [frame], {})).toEqual({ pens: [{ name: 'level' }, { name: 'flow' }] });
    expect(derivedTraits('trendchart', [frame], { pens: [] })).toEqual({ pens: [{ name: 'level' }, { name: 'flow' }] });
    expect(derivedTraits('trendchart', [frame], { pens: [{ name: 'mine' }] })).toEqual({});
  });

  it('gives an XYGraph one series per y field, and a WaveformChart one trace per field', () => {
    expect(derivedTraits('xygraph', [frame], {})).toEqual({ series: [{ name: 'flow' }] });
    expect(derivedTraits('waveformchart', [frame], {})).toEqual({ n_traces: 2 });
    expect(derivedTraits('waveformchart', [frame], { n_traces: 1 })).toEqual({});
  });

  it('leaves the other widgets alone', () => {
    expect(derivedTraits('sparkline', [frame], {})).toEqual({});
    expect(derivedTraits('gauge', [frame], {})).toEqual({});
  });
});
