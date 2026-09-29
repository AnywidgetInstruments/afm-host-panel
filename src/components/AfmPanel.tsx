// Grafana panel hosting one AFM widget (PNL-001 .. PNL-007): loads the module,
// creates the model, pushes traits computed from Grafana on each render, and
// routes the traits saved by the widget.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { css } from '@emotion/css';
import { PanelProps } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { Alert, useStyles2, useTheme2 } from '@grafana/ui';
import {
  AfmLoadError,
  Container,
  CssSource,
  cssSourceOf,
  importFromUrl,
  mountContainer,
  resolveWidget,
  startWidget,
  WidgetInstance,
} from '../afm/loader';
import { Diagnostic, mapTraits, planWriteBack, WriteBackWarnings } from '../afm/mapping';
import { AfmModel, Traits } from '../afm/model';
import { applyOptionsWriteBack, parseStaticTraits } from '../afm/options';
import { findWidget } from '../afm/registry';
import { AfmOptions, DEFAULT_OPTIONS } from '../types';

type Props = PanelProps<AfmOptions>;

const getStyles = () => ({
  wrapper: css`
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: auto;
  `,
  host: css`
    flex: 1;
    min-height: 0;
  `,
  diagnostics: css`
    font-size: 12px;
    opacity: 0.8;
    margin: 4px 0 0;
    padding-left: 16px;
  `,
});

interface Running {
  model: AfmModel;
  widget: WidgetInstance;
  container: Container;
  css: CssSource[];
}

/** Remote loading follows the Grafana switch for unsanitized panel HTML (design choice 3). */
const remoteEnabled = () => Boolean(config.disableSanitizeHtml);

export const AfmPanel: React.FC<Props> = (props) => {
  const { data, width, height, timeRange, replaceVariables, onOptionsChange } = props;
  const options = { ...DEFAULT_OPTIONS, ...props.options };
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const hostRef = useRef<HTMLDivElement>(null);
  const running = useRef<Running | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Latest props for the callbacks given to the model (they outlive a render).
  const latest = useRef({ options, onOptionsChange });
  const warnings = useMemo(() => new WriteBackWarnings(), []);

  // Static traits: keep the last valid ones while the JSON is being edited (PNL-006).
  const parsed = parseStaticTraits(options.staticTraits);
  const [validStatic, setValidStatic] = useState(parsed.ok ? options.staticTraits : '{}');
  if (parsed.ok && options.staticTraits !== validStatic) {
    setValidStatic(options.staticTraits);
  }
  const lastStatic = useMemo(() => {
    const last = parseStaticTraits(validStatic);
    return last.ok ? last.traits : {};
  }, [validStatic]);

  const entry = options.mode === 'builtin' ? findWidget(options.widget) : undefined;
  const mapped = mapTraits(options.bindings ?? [], { series: data.series, timeRange, replaceVariables });
  const traits: Traits = {
    ...(entry?.defaults ?? {}),
    ...lastStatic,
    ...mapped.traits,
    ...(options.sizeTraits ? { width, height } : {}),
  };
  const latestTraits = useRef(traits);
  const diagnostics: Diagnostic[] = mapped.diagnostics;
  const themeName: 'light' | 'dark' = theme.isDark ? 'dark' : 'light';
  const latestTheme = useRef(themeName);

  // Keep the refs read by the long-lived callbacks up to date. Declared before
  // the loading effect so it runs first in the same commit.
  useEffect(() => {
    latest.current = { options, onOptionsChange };
    latestTraits.current = traits;
    latestTheme.current = themeName;
  });

  const sourceKey = `${options.mode}|${options.mode === 'builtin' ? options.widget : `${options.url}|${options.cssUrl}`}|${options.isolation}`;

  // Load and start the widget; restart when the source changes (PNL-004), clean up on removal (PNL-003).
  useEffect(() => {
    const target = hostRef.current;
    if (!target) {
      return;
    }
    let cancelled = false;
    let started: Running | null = null;
    setError(null);
    setLoading(true);

    const onSave = (changes: Traits) => {
      const { options: current, onOptionsChange: change } = latest.current;
      let nextOptions = current;
      for (const action of planWriteBack(changes, current.bindings ?? [], warnings)) {
        if (action.kind === 'variable') {
          locationService.partial({ [`var-${action.variable}`]: action.value }, true);
        } else {
          nextOptions = applyOptionsWriteBack(nextOptions, action.trait, action.value);
        }
      }
      if (nextOptions !== current) {
        change(nextOptions);
      }
    };
    const onSend = (content: unknown, buffers: DataView[]) => {
      console.info('[afm-host] message from the widget (no kernel to receive it)', content, buffers);
    };

    (async () => {
      let mod: unknown;
      let css: CssSource[] = [];
      const name = options.mode === 'builtin' ? options.widget : options.url;
      if (options.mode === 'builtin') {
        const found = findWidget(options.widget);
        if (!found) {
          throw new AfmLoadError(`Unknown built-in widget "${options.widget}".`);
        }
        const loaded = await found.load();
        mod = loaded.module;
        css = loaded.css;
      } else {
        mod = await importFromUrl(options.url, { enabled: remoteEnabled(), baseUrl: window.location.href });
        if (options.cssUrl.trim()) {
          css = [{ url: options.cssUrl.trim() }];
        }
      }
      const def = await resolveWidget(mod, name);
      if (cancelled) {
        return;
      }
      const model = new AfmModel(latestTraits.current, { onSave, onSend });
      const traitCss = cssSourceOf(model.get('_css'));
      const container = mountContainer(target, {
        isolation: options.isolation,
        theme: latestTheme.current,
        css: traitCss ? [...css, traitCss] : css,
      });
      started = { model, container, css, widget: undefined as unknown as WidgetInstance };
      const widget = await startWidget(def, model);
      started.widget = widget;
      if (cancelled) {
        return;
      }
      await widget.render(container.el);
      if (!cancelled) {
        running.current = started;
        setLoading(false);
      }
    })().catch((err: unknown) => {
      if (!cancelled) {
        console.error('[afm-host] widget failed', err);
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      running.current = null;
      const s = started;
      if (s) {
        const done = s.widget ? s.widget.destroy() : Promise.resolve();
        done.finally(() => {
          s.container.dispose();
          s.model.off();
        });
      }
    };
    // The source key covers the options used here; traits and theme flow through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, warnings]);

  // Push new traits to the running widget without rendering it again (PNL-001, PNL-002).
  useEffect(() => {
    const r = running.current;
    if (!r) {
      return;
    }
    r.model.update(traits);
    const traitCss = cssSourceOf(traits._css);
    r.container.setCss(traitCss ? [...r.css, traitCss] : r.css);
  });

  useEffect(() => {
    running.current?.container.setTheme(themeName);
  }, [themeName]);

  return (
    <div className={styles.wrapper} data-testid="afm-panel" style={{ width, height }}>
      {error && (
        <Alert severity="error" title="Widget error" data-testid="afm-panel-error">
          {error}
        </Alert>
      )}
      {!parsed.ok && (
        <Alert severity="warning" title="Static traits">
          {parsed.error}
        </Alert>
      )}
      <div ref={hostRef} className={styles.host} data-testid="afm-panel-host" aria-busy={loading} />
      {options.showDiagnostics && diagnostics.length > 0 && (
        <ul className={styles.diagnostics} data-testid="afm-panel-diagnostics">
          {diagnostics.map((d) => (
            <li key={`${d.trait}:${d.message}`}>
              {d.trait}: {d.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
