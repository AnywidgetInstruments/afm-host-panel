import { createDataFrame, dateTime, FieldType } from '@grafana/data';
import { MappingContext, mapTraits, planWriteBack, TraitBinding, WriteBackWarnings } from './mapping';

const frameA = createDataFrame({
  refId: 'A',
  name: 'temperatures',
  fields: [
    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
    { name: 'temp', type: FieldType.number, values: [20, 21, null, null] },
    { name: 'state', type: FieldType.string, values: ['ok', 'ok', 'hot', null] },
  ],
});
const frameB = createDataFrame({
  refId: 'B',
  fields: [
    { name: 'time', type: FieldType.time, values: [1000, 2000] },
    { name: 'speed', type: FieldType.number, values: [50, 70], config: { displayName: 'Vehicle speed' } },
    { name: 'nulls', type: FieldType.number, values: [null, null] },
  ],
});
const empty = createDataFrame({ refId: 'C', fields: [] });

const variables: Record<string, string> = { site: 'Poitiers', limit: '42.5', bad: 'abc', list: '["a","b"]' };

function ctx(overrides: Partial<MappingContext> = {}): MappingContext {
  return {
    series: [frameA, frameB, empty],
    timeRange: { from: dateTime(1_000_000), to: dateTime(2_000_000) },
    // Grafana returns the text unchanged when a variable does not exist.
    replaceVariables: (text: string) =>
      text.replace(/\$\{(\w+)(?::(\w+))?\}|\$(\w+)/g, (m, a, format, b) => {
        const name = a ?? b;
        if (!(name in variables)) {
          return m;
        }
        return format === 'json' ? JSON.stringify(variables[name]) : variables[name];
      }),
    ...overrides,
  };
}

const one = (binding: TraitBinding, c = ctx()) => mapTraits([binding], c);

describe('mapTraits', () => {
  describe('field source (MAP-001)', () => {
    it('reduces a field to its last non-null value by default', () => {
      expect(one({ trait: 'value', source: 'field', field: 'temp' }).traits).toEqual({ value: 21 });
    });

    it('uses the requested reducer', () => {
      expect(one({ trait: 'v', source: 'field', field: 'temp', reducer: 'max' }).traits).toEqual({ v: 21 });
      expect(one({ trait: 'v', source: 'field', field: 'speed', reducer: 'mean' }).traits).toEqual({ v: 60 });
    });

    it('finds a field by display name and restricts the search to a frame', () => {
      expect(one({ trait: 'v', source: 'field', field: 'Vehicle speed' }).traits).toEqual({ v: 70 });
      expect(one({ trait: 'v', source: 'field', frame: 'B', field: 'time', reducer: 'first' }).traits).toEqual({
        v: 1000,
      });
      expect(one({ trait: 'v', source: 'field', frame: 'temperatures', field: 'temp' }).traits).toEqual({ v: 21 });
    });

    it('takes the first number field when no field is named', () => {
      expect(one({ trait: 'v', source: 'field' }).traits).toEqual({ v: 21 });
      expect(one({ trait: 'v', source: 'field', frame: 'B' }).traits).toEqual({ v: 70 });
    });

    it('reduces a string field', () => {
      expect(one({ trait: 'v', source: 'field', field: 'state' }).traits).toEqual({ v: 'hot' });
    });

    it.each([
      ['an absent field', { field: 'nope' }, /field "nope" not found/],
      ['an absent frame', { frame: 'Z', field: 'temp' }, /frame "Z" not found/],
      ['only null values', { field: 'nulls' }, /no value/],
      ['an unknown reducer', { field: 'temp', reducer: 'median-ish' }, /unknown reducer/],
    ])('leaves the trait unset for %s, with a diagnostic (MAP-006)', (_label, extra, message) => {
      const r = one({ trait: 'v', source: 'field', ...extra });
      expect(r.traits).toEqual({});
      expect(r.diagnostics).toEqual([{ trait: 'v', message: expect.stringMatching(message) }]);
    });

    it('reports no data when there is no frame', () => {
      const r = one({ trait: 'v', source: 'field' }, ctx({ series: [] }));
      expect(r.traits).toEqual({});
      expect(r.diagnostics[0].message).toMatch(/no data/);
    });

    it('reports an empty frame', () => {
      const r = one({ trait: 'v', source: 'field', frame: 'C' });
      expect(r.diagnostics[0].message).toMatch(/no field/);
    });
  });

  describe('series source (MAP-002)', () => {
    it('gives all the values of a field as an array, nulls kept', () => {
      expect(one({ trait: 'values', source: 'series', field: 'temp' }).traits).toEqual({
        values: [20, 21, null, null],
      });
    });

    it('gives an empty array for an empty field', () => {
      const f = createDataFrame({ fields: [{ name: 'x', type: FieldType.number, values: [] }] });
      expect(one({ trait: 'values', source: 'series', field: 'x' }, ctx({ series: [f] })).traits).toEqual({
        values: [],
      });
    });

    it('reports an absent field', () => {
      expect(one({ trait: 'values', source: 'series', field: 'nope' }).diagnostics).toHaveLength(1);
    });
  });

  describe('static source (MAP-003)', () => {
    it('copies the value', () => {
      const value = { a: [1, 2] };
      const r = one({ trait: 'cfg', source: 'static', value });
      expect(r.traits).toEqual({ cfg: { a: [1, 2] } });
      expect(r.traits.cfg).not.toBe(value);
    });

    it('accepts null as a value', () => {
      expect(one({ trait: 'x', source: 'static', value: null }).traits).toEqual({ x: null });
    });
  });

  describe('variable source (MAP-004)', () => {
    it.each([
      ['text', 'site', 'Poitiers'],
      ['number', 'limit', 42.5],
      ['json', 'list', ['a', 'b']],
    ] as const)('parses a variable as %s', (parse, variable, expected) => {
      expect(one({ trait: 'v', source: 'variable', variable, parse }).traits).toEqual({ v: expected });
    });

    it('accepts a name written with a dollar sign', () => {
      expect(one({ trait: 'v', source: 'variable', variable: '$site' }).traits).toEqual({ v: 'Poitiers' });
    });

    it.each([
      ['an unresolved variable', { variable: 'missing' }, /variable "missing" is not defined/],
      ['an invalid number', { variable: 'bad', parse: 'number' as const }, /not a number/],
      ['invalid JSON', { variable: 'site', parse: 'json' as const }, /not valid JSON/],
      ['an empty name', { variable: '' }, /no variable/],
    ])('leaves the trait unset for %s (MAP-006)', (_label, extra, message) => {
      const r = one({ trait: 'v', source: 'variable', ...extra });
      expect(r.traits).toEqual({});
      expect(r.diagnostics[0].message).toMatch(message);
    });
  });

  describe('time source (MAP-005)', () => {
    it.each([
      ['from', 1_000_000],
      ['to', 2_000_000],
      ['range', { from: 1_000_000, to: 2_000_000 }],
    ] as const)('gives the %s of the time range in milliseconds', (time, expected) => {
      expect(one({ trait: 't', source: 'time', time }).traits).toEqual({ t: expected });
    });

    it.each([
      ['from', '1970-01-01T00:16:40.000Z'],
      ['range', { from: '1970-01-01T00:16:40.000Z', to: '1970-01-01T00:33:20.000Z' }],
    ] as const)('gives the %s as ISO 8601 text when asked', (time, expected) => {
      expect(one({ trait: 't', source: 'time', time, timeFormat: 'iso' }).traits).toEqual({ t: expected });
    });
  });

  it('applies bindings in order, the last one winning', () => {
    const r = mapTraits(
      [
        { trait: 'v', source: 'static', value: 1 },
        { trait: 'v', source: 'field', field: 'speed' },
      ],
      ctx()
    );
    expect(r.traits).toEqual({ v: 70 });
  });

  it('ignores bindings without a trait name', () => {
    const r = mapTraits([{ trait: ' ', source: 'static', value: 1 }], ctx());
    expect(r.traits).toEqual({});
    expect(r.diagnostics).toEqual([]);
  });
});

describe('planWriteBack', () => {
  const bindings: TraitBinding[] = [
    { trait: 'value', source: 'variable', variable: 'count', parse: 'number', writeBack: 'variable' },
    { trait: 'label', source: 'static', value: 'x', writeBack: 'options' },
    { trait: 'target', source: 'field', field: 'temp', writeBack: 'variable', writeVariable: 'setpoint' },
    { trait: 'readonly', source: 'field', field: 'temp' },
  ];

  it('routes a trait bound to a variable to that variable (MAP-007)', () => {
    const plan = planWriteBack({ value: 5 }, bindings, new WriteBackWarnings());
    expect(plan).toEqual([{ kind: 'variable', variable: 'count', value: '5' }]);
  });

  it('uses writeVariable when the source is not a variable, and serializes objects as JSON', () => {
    const plan = planWriteBack({ target: { a: 1 } }, bindings, new WriteBackWarnings());
    expect(plan).toEqual([{ kind: 'variable', variable: 'setpoint', value: '{"a":1}' }]);
  });

  it('routes a trait bound to the options to the static traits (MAP-008)', () => {
    expect(planWriteBack({ label: 'new' }, bindings, new WriteBackWarnings())).toEqual([
      { kind: 'options', trait: 'label', value: 'new' },
    ]);
  });

  it('ignores other traits with one console warning per trait (MAP-009)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const warnings = new WriteBackWarnings();
    expect(planWriteBack({ readonly: 1, alarm_level: 'hi' }, bindings, warnings)).toEqual([]);
    planWriteBack({ readonly: 2, alarm_level: 'lo' }, bindings, warnings);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls.map((c) => c[0]).join('\n')).toMatch(/readonly[\s\S]*alarm_level/);
    warn.mockRestore();
  });

  it('warns when a variable write-back has no variable name', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const plan = planWriteBack(
      { v: 1 },
      [{ trait: 'v', source: 'static', value: 0, writeBack: 'variable' }],
      new WriteBackWarnings()
    );
    expect(plan).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
