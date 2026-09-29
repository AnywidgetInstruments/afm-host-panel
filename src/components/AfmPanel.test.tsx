import React from 'react';
import { act, configure, render, screen, waitFor } from '@testing-library/react';
import {
  createDataFrame,
  dateTime,
  EventBusSrv,
  FieldType,
  LoadingState,
  PanelData,
  PanelProps,
  TimeRange,
} from '@grafana/data';
import { AfmPanel } from './AfmPanel';
import { AfmOptions, DEFAULT_OPTIONS } from '../types';
import type { AfmModel } from '../afm/model';

// Loading a widget is asynchronous (dynamic imports); on a loaded CI machine or
// a slow disk it can exceed the 1 s default of findBy / waitFor.
configure({ asyncUtilTimeout: 10000 });
jest.setTimeout(30000);

const mockPartial = jest.fn();
const mockConfig = { disableSanitizeHtml: false };
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: new Proxy(
    {},
    { get: (_t, key: string) => (key in mockConfig ? mockConfig[key as keyof typeof mockConfig] : undefined) }
  ),
  locationService: { partial: (...args: unknown[]) => mockPartial(...args) },
}));

// A spy widget, registered as test:Spy.
const spy = {
  renders: 0,
  cleanups: 0,
  model: undefined as AfmModel | undefined,
  el: undefined as HTMLElement | undefined,
};
jest.mock('../afm/registry', () => {
  const actual = jest.requireActual('../afm/registry');
  const entry = {
    id: 'test:Spy',
    label: 'Spy',
    group: 'Test',
    description: '',
    defaults: { kind: 'spy' },
    load: async () => ({
      module: {
        default: {
          render: ({ model, el }: { model: AfmModel; el: HTMLElement }) => {
            spy.renders += 1;
            spy.model = model;
            spy.el = el;
            const show = () => (el.textContent = `value=${JSON.stringify(model.get('value'))}`);
            model.on('change:value', show);
            show();
            return () => {
              spy.cleanups += 1;
              model.off('change:value', show);
            };
          },
        },
      },
      css: [{ text: '.spy{}' }],
    }),
  };
  return {
    ...actual,
    findWidget: (id: string) => (id === 'test:Spy' ? entry : actual.findWidget(id)),
  };
});

const timeRange: TimeRange = {
  from: dateTime(1000),
  to: dateTime(2000),
  raw: { from: 'now-6h', to: 'now' },
};

function panelData(values: number[]): PanelData {
  return {
    state: LoadingState.Done,
    timeRange,
    series: [
      createDataFrame({
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: values.map((_, i) => i) },
          { name: 'speed', type: FieldType.number, values },
        ],
      }),
    ],
  };
}

function props(options: Partial<AfmOptions>, values = [1, 2, 3], extra: Partial<PanelProps<AfmOptions>> = {}) {
  return {
    id: 1,
    data: panelData(values),
    timeRange,
    timeZone: 'utc',
    options: { ...DEFAULT_OPTIONS, widget: 'test:Spy', ...options },
    transparent: false,
    width: 400,
    height: 300,
    fieldConfig: { defaults: {}, overrides: [] },
    renderCounter: 0,
    title: 'Test',
    eventBus: new EventBusSrv(),
    onOptionsChange: jest.fn(),
    onFieldConfigChange: jest.fn(),
    replaceVariables: (s: string) => s.replace('${count}', '7'),
    onChangeTimeRange: jest.fn(),
    ...extra,
  } as PanelProps<AfmOptions>;
}

const speedBinding = { trait: 'value', source: 'field' as const, field: 'speed' };

beforeEach(() => {
  spy.renders = 0;
  spy.cleanups = 0;
  spy.model = undefined;
  spy.el = undefined;
  mockPartial.mockReset();
  mockConfig.disableSanitizeHtml = false;
});

describe('AfmPanel', () => {
  it('mounts the widget in a shadow root with its CSS and the mapped traits', async () => {
    render(<AfmPanel {...props({ bindings: [speedBinding] })} />);
    await waitFor(() => expect(spy.renders).toBe(1));
    const host = screen.getByTestId('afm-panel-host');
    expect(host.shadowRoot?.textContent).toContain('value=3');
    expect(host.shadowRoot?.querySelector('.afm-host-styles style')?.textContent).toBe('.spy{}');
    expect(spy.model?.get('kind')).toBe('spy'); // registry defaults
  });

  it('updates the traits on new data without rendering again (PNL-001)', async () => {
    const { rerender } = render(<AfmPanel {...props({ bindings: [speedBinding] })} />);
    await waitFor(() => expect(spy.renders).toBe(1));
    rerender(<AfmPanel {...props({ bindings: [speedBinding] }, [4, 5, 99])} />);
    await waitFor(() => expect(spy.el?.textContent).toBe('value=99'));
    expect(spy.renders).toBe(1);
  });

  it('sets the size traits on resize when enabled (PNL-002, MAP-010)', async () => {
    const { rerender } = render(<AfmPanel {...props({ sizeTraits: true })} />);
    await waitFor(() => expect(spy.model?.get('width')).toBe(400));
    rerender(<AfmPanel {...props({ sizeTraits: true }, undefined, { width: 250, height: 120 })} />);
    await waitFor(() => expect(spy.model?.get('width')).toBe(250));
    expect(spy.model?.get('height')).toBe(120);
  });

  it('does not set size traits when disabled', async () => {
    render(<AfmPanel {...props({})} />);
    await waitFor(() => expect(spy.renders).toBe(1));
    expect(spy.model?.get('width')).toBeUndefined();
  });

  it('cleans up and removes every subscription on unmount (PNL-003)', async () => {
    const { unmount } = render(<AfmPanel {...props({ bindings: [speedBinding] })} />);
    await waitFor(() => expect(spy.renders).toBe(1));
    const model = spy.model!;
    unmount();
    await waitFor(() => expect(spy.cleanups).toBe(1));
    await waitFor(() => expect(model.listenerCount()).toBe(0));
  });

  it('writes a saved trait to its dashboard variable (MAP-007)', async () => {
    const bindings = [
      {
        trait: 'value',
        source: 'variable' as const,
        variable: 'count',
        parse: 'number' as const,
        writeBack: 'variable' as const,
      },
    ];
    render(<AfmPanel {...props({ bindings })} />);
    await waitFor(() => expect(spy.model?.get('value')).toBe(7));
    act(() => {
      spy.model!.set('value', 8);
      spy.model!.save_changes();
    });
    expect(mockPartial).toHaveBeenCalledWith({ 'var-count': '8' }, true);
  });

  it('writes a saved trait to the options (MAP-008)', async () => {
    const p = props({ bindings: [{ trait: 'label', source: 'static', value: 'a', writeBack: 'options' }] });
    render(<AfmPanel {...p} />);
    await waitFor(() => expect(spy.renders).toBe(1));
    act(() => {
      spy.model!.set('label', 'b');
      spy.model!.save_changes();
    });
    expect(p.onOptionsChange).toHaveBeenCalledWith(
      expect.objectContaining({ bindings: [expect.objectContaining({ trait: 'label', value: 'b' })] })
    );
  });

  it('shows an error, not a crash, when remote loading is disabled (LOAD-007, LOAD-008)', async () => {
    render(<AfmPanel {...props({ mode: 'url', url: 'https://example.org/w.js' })} />);
    expect(await screen.findByTestId('afm-panel-error')).toHaveTextContent(/disabled/);
  });

  it('shows an error for an invalid URL when remote loading is enabled', async () => {
    mockConfig.disableSanitizeHtml = true;
    render(<AfmPanel {...props({ mode: 'url', url: 'http://insecure.example.org/w.js' })} />);
    expect(await screen.findByTestId('afm-panel-error')).toHaveTextContent(/https/);
  });

  it('shows an error for an unknown built-in widget', async () => {
    render(<AfmPanel {...props({ widget: 'nope:Nothing' })} />);
    expect(await screen.findByTestId('afm-panel-error')).toHaveTextContent(/Unknown built-in widget/);
  });

  it('switches widget when the source changes (PNL-004)', async () => {
    const { rerender } = render(<AfmPanel {...props({})} />);
    await waitFor(() => expect(spy.renders).toBe(1));
    rerender(<AfmPanel {...props({ widget: 'examples:Gauge' })} />);
    await waitFor(() => expect(spy.cleanups).toBe(1));
    await waitFor(() => expect(screen.getByTestId('afm-panel-host').shadowRoot?.querySelector('svg')).not.toBeNull());
  });

  it('keeps the last valid static traits and warns about invalid JSON (PNL-006)', async () => {
    const { rerender } = render(<AfmPanel {...props({ staticTraits: '{"value": 5}' })} />);
    await waitFor(() => expect(spy.el?.textContent).toBe('value=5'));
    rerender(<AfmPanel {...props({ staticTraits: '{"value": ' })} />);
    expect(await screen.findByText(/Invalid JSON/)).toBeInTheDocument();
    expect(spy.el?.textContent).toBe('value=5');
  });

  it('lists unresolved bindings when diagnostics are enabled (PNL-007)', async () => {
    render(
      <AfmPanel {...props({ showDiagnostics: true, bindings: [{ trait: 'value', source: 'field', field: 'nope' }] })} />
    );
    expect(await screen.findByTestId('afm-panel-diagnostics')).toHaveTextContent('value: field "nope" not found');
  });
});
