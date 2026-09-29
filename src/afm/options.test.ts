import { applyOptionsWriteBack, parseStaticTraits } from './options';
import { DEFAULT_OPTIONS } from '../types';

describe('parseStaticTraits (PNL-006)', () => {
  it('parses a JSON object', () => {
    expect(parseStaticTraits('{"label": "A", "max": 5}')).toEqual({ ok: true, traits: { label: 'A', max: 5 } });
  });

  it('treats empty text as no traits', () => {
    expect(parseStaticTraits('  ')).toEqual({ ok: true, traits: {} });
    expect(parseStaticTraits(undefined)).toEqual({ ok: true, traits: {} });
  });

  it.each([
    ['{bad', /JSON/],
    ['[1, 2]', /object/],
    ['42', /object/],
    ['null', /object/],
  ])('rejects %s', (text, message) => {
    const r = parseStaticTraits(text);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(message);
  });
});

describe('applyOptionsWriteBack (MAP-008)', () => {
  it('updates the value of a static binding of the trait', () => {
    const options = {
      ...DEFAULT_OPTIONS,
      bindings: [{ trait: 'label', source: 'static' as const, value: 'old', writeBack: 'options' as const }],
    };
    const next = applyOptionsWriteBack(options, 'label', 'new');
    expect(next.bindings[0].value).toBe('new');
    expect(options.bindings[0].value).toBe('old');
  });

  it('otherwise stores the trait in the static traits JSON, keeping the others', () => {
    const options = { ...DEFAULT_OPTIONS, staticTraits: '{"a": 1}' };
    const next = applyOptionsWriteBack(options, 'b', [1, 2]);
    expect(JSON.parse(next.staticTraits)).toEqual({ a: 1, b: [1, 2] });
  });

  it('replaces invalid static traits rather than failing', () => {
    const next = applyOptionsWriteBack({ ...DEFAULT_OPTIONS, staticTraits: '{bad' }, 'b', 2);
    expect(JSON.parse(next.staticTraits)).toEqual({ b: 2 });
  });
});
