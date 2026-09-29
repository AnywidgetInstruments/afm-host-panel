import { AfmModel } from './model';
import {
  AfmLoadError,
  checkModuleUrl,
  cssSourceOf,
  importFromUrl,
  mountContainer,
  resolveWidget,
  startWidget,
} from './loader';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('resolveWidget (LOAD-001, LOAD-002)', () => {
  const render = () => {};

  it('accepts a module namespace whose default export is an object', async () => {
    const def = await resolveWidget({ default: { render } }, 'm');
    expect(def.render).toBe(render);
  });

  it('accepts a default export that is a function returning the object', async () => {
    const def = await resolveWidget({ default: () => ({ render }) }, 'm');
    expect(def.render).toBe(render);
  });

  it('accepts a function returning a promise of the object', async () => {
    const def = await resolveWidget({ default: async () => ({ render }) }, 'm');
    expect(def.render).toBe(render);
  });

  it('accepts a module with initialize only', async () => {
    const initialize = () => {};
    const def = await resolveWidget({ default: { initialize } }, 'm');
    expect(def.initialize).toBe(initialize);
    expect(def.render).toBeUndefined();
  });

  it('accepts the widget object itself (not a namespace)', async () => {
    const def = await resolveWidget({ render }, 'm');
    expect(def.render).toBe(render);
  });

  it.each([
    ['nothing', undefined],
    ['a number', { default: 42 }],
    ['an object without hooks', { default: { foo: 1 } }],
    ['non-function hooks', { default: { render: 'x' } }],
    ['a factory returning nothing', { default: () => undefined }],
  ])('rejects %s with a message naming the module and the expected exports', async (_label, mod) => {
    await expect(resolveWidget(mod, 'my-widget')).rejects.toThrow(AfmLoadError);
    await expect(resolveWidget(mod, 'my-widget')).rejects.toThrow(/my-widget.*initialize.*render/);
  });

  it('rejects when the factory throws, keeping the cause', async () => {
    const boom = new Error('boom');
    const err = await resolveWidget(
      {
        default: () => {
          throw boom;
        },
      },
      'w'
    ).catch((e) => e);
    expect(err).toBeInstanceOf(AfmLoadError);
    expect(err.message).toMatch(/boom/);
    expect(err.cause).toBe(boom);
  });
});

describe('startWidget lifecycle', () => {
  it('awaits initialize before the first render (LOAD-003)', async () => {
    const calls: string[] = [];
    const model = new AfmModel({});
    const def = {
      initialize: async () => {
        await flush();
        calls.push('initialize');
      },
      render: () => {
        calls.push('render');
      },
    };
    const widget = await startWidget(def, model);
    await widget.render(document.createElement('div'));
    expect(calls).toEqual(['initialize', 'render']);
  });

  it('passes model, signal and experimental to initialize, plus el and host to render (LOAD-011)', async () => {
    const model = new AfmModel({});
    const initialize = jest.fn();
    const render = jest.fn();
    const widget = await startWidget({ initialize, render }, model);
    const el = document.createElement('div');
    await widget.render(el);
    const initProps = initialize.mock.calls[0][0];
    expect(initProps.model).toBe(model);
    expect(initProps.signal).toBeInstanceOf(AbortSignal);
    expect(typeof initProps.experimental.invoke).toBe('function');
    const renderProps = render.mock.calls[0][0];
    expect(renderProps.model).toBe(model);
    expect(renderProps.el).toBe(el);
    expect(renderProps.signal).toBeInstanceOf(AbortSignal);
    await expect(renderProps.host.getWidget('anywidget:1')).rejects.toThrow(/anywidget:1/);
    await expect(renderProps.host.getModel('anywidget:2')).rejects.toThrow(/anywidget:2/);
    await expect(renderProps.experimental.invoke('x')).rejects.toThrow(/not supported/);
  });

  it('supports an async render', async () => {
    const model = new AfmModel({});
    const el = document.createElement('div');
    const widget = await startWidget(
      {
        render: async ({ el }: { el: HTMLElement }) => {
          await flush();
          el.textContent = 'ready';
        },
      },
      model
    );
    await widget.render(el);
    expect(el.textContent).toBe('ready');
  });

  it('works with initialize only (no view)', async () => {
    const model = new AfmModel({});
    const initialize = jest.fn();
    const widget = await startWidget({ initialize }, model);
    await expect(widget.render(document.createElement('div'))).resolves.toBeDefined();
    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it('aborts and cleans views, then the model, on destroy (LOAD-004)', async () => {
    const calls: string[] = [];
    let initSignal: AbortSignal | undefined;
    let renderSignal: AbortSignal | undefined;
    const model = new AfmModel({});
    const widget = await startWidget(
      {
        initialize: ({ signal }: { signal: AbortSignal }) => {
          initSignal = signal;
          return () => calls.push(`init cleanup, init aborted=${signal.aborted}`);
        },
        render: ({ signal }: { signal: AbortSignal }) => {
          renderSignal = signal;
          return async () => {
            await flush();
            calls.push(`render cleanup, render aborted=${signal.aborted}, init aborted=${initSignal?.aborted}`);
          };
        },
      },
      model
    );
    await widget.render(document.createElement('div'));
    await widget.destroy();
    expect(renderSignal?.aborted).toBe(true);
    expect(initSignal?.aborted).toBe(true);
    expect(calls).toEqual([
      'render cleanup, render aborted=true, init aborted=false',
      'init cleanup, init aborted=true',
    ]);
  });

  it('removes a single view without touching the model', async () => {
    const initCleanup = jest.fn();
    const renderCleanup = jest.fn();
    const widget = await startWidget({ initialize: () => initCleanup, render: () => renderCleanup }, new AfmModel({}));
    const view = await widget.render(document.createElement('div'));
    await view.remove();
    expect(renderCleanup).toHaveBeenCalledTimes(1);
    expect(initCleanup).not.toHaveBeenCalled();
    await widget.destroy();
    expect(renderCleanup).toHaveBeenCalledTimes(1);
    expect(initCleanup).toHaveBeenCalledTimes(1);
  });

  it('ignores an exports object returned by initialize', async () => {
    const widget = await startWidget({ initialize: () => ({ answer: 42 }) }, new AfmModel({}));
    expect(widget.exports).toEqual({ answer: 42 });
    await expect(widget.destroy()).resolves.toBeUndefined();
  });

  it('runs the cleanup of a render that resolves after destroy', async () => {
    let resolveRender: (fn: () => void) => void = () => {};
    const cleanup = jest.fn();
    const widget = await startWidget(
      { render: () => new Promise<() => void>((r) => (resolveRender = r)) },
      new AfmModel({})
    );
    const pending = widget.render(document.createElement('div'));
    const destroyed = widget.destroy();
    resolveRender(cleanup);
    await pending.catch(() => {});
    await destroyed;
    await flush();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('rejects when initialize throws and aborts its signal', async () => {
    let signal: AbortSignal | undefined;
    const err = await startWidget(
      {
        initialize: (props: { signal: AbortSignal }) => {
          signal = props.signal;
          throw new Error('init failed');
        },
      },
      new AfmModel({})
    ).catch((e) => e);
    expect(err).toBeInstanceOf(AfmLoadError);
    expect(err.message).toMatch(/initialize.*init failed/);
    expect(signal?.aborted).toBe(true);
  });

  it('rejects when render throws and aborts its signal', async () => {
    let signal: AbortSignal | undefined;
    const widget = await startWidget(
      {
        render: (props: { signal: AbortSignal }) => {
          signal = props.signal;
          throw new Error('render failed');
        },
      },
      new AfmModel({})
    );
    await expect(widget.render(document.createElement('div'))).rejects.toThrow(/render.*render failed/);
    expect(signal?.aborted).toBe(true);
  });

  it('logs a failing cleanup and continues', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const initCleanup = jest.fn();
    const widget = await startWidget(
      {
        initialize: () => initCleanup,
        render: () => () => {
          throw new Error('cleanup failed');
        },
      },
      new AfmModel({})
    );
    await widget.render(document.createElement('div'));
    await widget.destroy();
    expect(initCleanup).toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('remote modules (LOAD-006, LOAD-007)', () => {
  const origin = 'https://grafana.example.com';

  it.each([
    ['https://cdn.example.org/widget.js', 'https://cdn.example.org/widget.js'],
    ['/public/widgets/w.js', 'https://grafana.example.com/public/widgets/w.js'],
    ['./w.js', 'https://grafana.example.com/d/w.js'],
  ])('accepts %s', (url, resolved) => {
    expect(checkModuleUrl(url, `${origin}/d/abc`)).toBe(resolved);
  });

  it.each([
    ['http://cdn.example.org/widget.js', /https/],
    ['javascript:alert(1)', /https/],
    ['data:text/javascript,export default {}', /https/],
    ['', /empty/i],
    ['http://[bad', /invalid/i],
  ])('rejects %s', (url, message) => {
    expect(() => checkModuleUrl(url, `${origin}/d/abc`)).toThrow(message);
  });

  it('accepts http on the same origin', () => {
    expect(checkModuleUrl('http://localhost:3000/w.js', 'http://localhost:3000/d/x')).toBe(
      'http://localhost:3000/w.js'
    );
  });

  it('refuses to load while remote loading is disabled, without calling the importer', async () => {
    const importer = jest.fn();
    await expect(importFromUrl('https://x.org/w.js', { enabled: false, baseUrl: origin, importer })).rejects.toThrow(
      /disabled/
    );
    expect(importer).not.toHaveBeenCalled();
  });

  it('imports through the importer when enabled', async () => {
    const importer = jest.fn().mockResolvedValue({ default: { render() {} } });
    const mod = await importFromUrl('https://x.org/w.js', { enabled: true, baseUrl: origin, importer });
    expect(importer).toHaveBeenCalledWith('https://x.org/w.js');
    expect(mod).toHaveProperty('default');
  });

  it('wraps an import failure in a clear error', async () => {
    const importer = jest.fn().mockRejectedValue(new TypeError('Failed to fetch dynamically imported module'));
    await expect(importFromUrl('https://x.org/w.js', { enabled: true, baseUrl: origin, importer })).rejects.toThrow(
      /Cannot load.*https:\/\/x\.org\/w\.js.*Failed to fetch/
    );
  });
});

describe('cssSourceOf', () => {
  it.each([
    ['https://x.org/a.css', { url: 'https://x.org/a.css' }],
    ['/public/a.css', { url: '/public/a.css' }],
    ['.a { color: red }', { text: '.a { color: red }' }],
    ['', undefined],
    [undefined, undefined],
    [42, undefined],
  ])('classifies %p', (value, expected) => {
    expect(cssSourceOf(value)).toEqual(expected);
  });
});

describe('mountContainer (LOAD-009, LOAD-010, LOAD-012)', () => {
  it('renders into a shadow root holding the CSS and the theme', () => {
    const target = document.createElement('div');
    const c = mountContainer(target, { isolation: 'shadow', theme: 'dark', css: [{ text: '.x{color:red}' }] });
    const root = target.shadowRoot!;
    expect(root).not.toBeNull();
    expect(root.querySelector('.afm-host-styles style')!.textContent).toBe('.x{color:red}');
    expect(root.querySelector('[data-theme="dark"]')).not.toBeNull();
    expect(root.contains(c.el)).toBe(true);
    c.setTheme('light');
    expect(root.querySelector('[data-theme="light"]')).not.toBeNull();
  });

  it('fills the panel with the widget element and centers its children', () => {
    const target = document.createElement('div');
    const c = mountContainer(target, { isolation: 'shadow', theme: 'light' });
    expect(c.el.style.width).toBe('100%');
    expect(c.el.style.height).toBe('100%');
    expect(c.el.style.display).toBe('flex');
    const layout = [...target.shadowRoot!.querySelectorAll('style')].map((s) => s.textContent);
    expect(layout).toContain('.afm-host-widget > * { margin: auto; }');
  });

  it('adds a stylesheet link for a CSS URL and replaces the CSS on update', () => {
    const target = document.createElement('div');
    const c = mountContainer(target, { isolation: 'shadow', theme: 'light', css: [{ url: 'https://x.org/a.css' }] });
    const root = target.shadowRoot!;
    expect(root.querySelector('link')!.getAttribute('href')).toBe('https://x.org/a.css');
    c.setCss([{ text: 'b{}' }]);
    expect(root.querySelector('link')).toBeNull();
    expect(root.querySelectorAll('.afm-host-styles style')).toHaveLength(1);
  });

  it('reuses the shadow root of the target when mounted again', () => {
    const target = document.createElement('div');
    mountContainer(target, { isolation: 'shadow', theme: 'light' }).dispose();
    const c = mountContainer(target, { isolation: 'shadow', theme: 'light' });
    expect(target.shadowRoot!.contains(c.el)).toBe(true);
    expect(target.shadowRoot!.childNodes).toHaveLength(1);
  });

  it('renders in the target itself without isolation, CSS scoped by an attribute', () => {
    const target = document.createElement('div');
    const c = mountContainer(target, { isolation: 'none', theme: 'dark', css: [{ text: '.x{}' }] });
    expect(target.shadowRoot).toBeNull();
    expect(target.contains(c.el)).toBe(true);
    expect(target.querySelector('.afm-host-styles style')!.textContent).toBe('.x{}');
  });

  it('removes everything on dispose', () => {
    const target = document.createElement('div');
    const c = mountContainer(target, { isolation: 'none', theme: 'dark', css: [{ text: '.x{}' }] });
    c.dispose();
    expect(target.childNodes).toHaveLength(0);
  });
});
