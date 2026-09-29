// Editor of the trait bindings: one row per trait, its source and its
// write-back (PNL-005).
import React from 'react';
import { fieldReducers, SelectableValue, StandardEditorProps } from '@grafana/data';
import { Button, IconButton, InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import type { SourceKind, TraitBinding, VariableParse, WriteBack } from '../afm/mapping';

const SOURCES: Array<SelectableValue<SourceKind>> = [
  { value: 'field', label: 'Field (reduced)', description: 'One value of a field, computed by a reducer' },
  { value: 'series', label: 'Field (all values)', description: 'Every value of a field, as an array' },
  { value: 'static', label: 'Static value', description: 'A JSON value' },
  { value: 'variable', label: 'Dashboard variable', description: 'Resolved with the dashboard variables' },
  { value: 'time', label: 'Time range', description: 'Start, end or both, in milliseconds' },
];
const PARSES: Array<SelectableValue<VariableParse>> = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'json', label: 'JSON' },
];
const TIMES: Array<SelectableValue<'from' | 'to' | 'range'>> = [
  { value: 'range', label: 'Range' },
  { value: 'from', label: 'From' },
  { value: 'to', label: 'To' },
];
const TIME_FORMATS: Array<SelectableValue<'ms' | 'iso'>> = [
  { value: 'ms', label: 'Milliseconds' },
  { value: 'iso', label: 'ISO 8601' },
];
const WRITE_BACKS: Array<SelectableValue<WriteBack>> = [
  { value: 'none', label: 'None' },
  { value: 'variable', label: 'Variable' },
  { value: 'options', label: 'Panel options' },
];

const reducerOptions = (): Array<SelectableValue<string>> =>
  fieldReducers.list().map((r) => ({ value: r.id, label: r.name, description: r.description }));

const LABEL_WIDTH = 12;

function jsonText(value: unknown): string {
  return value === undefined ? '' : JSON.stringify(value);
}

function parseJsonOrText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text; // plain text is kept as a string
  }
}

interface RowProps {
  binding: TraitBinding;
  index: number;
  onChange: (binding: TraitBinding) => void;
  onRemove: () => void;
}

const BindingRow: React.FC<RowProps> = ({ binding, index, onChange, onRemove }) => {
  const set = (patch: Partial<TraitBinding>) => onChange({ ...binding, ...patch });
  const n = index + 1;
  return (
    <div style={{ borderLeft: '2px solid rgba(128,128,128,0.4)', paddingLeft: 8, marginBottom: 12 }}>
      <InlineFieldRow>
        <InlineField label="Trait" labelWidth={LABEL_WIDTH} grow>
          <Input
            aria-label={`Trait of binding ${n}`}
            value={binding.trait}
            placeholder="value"
            onChange={(e) => set({ trait: e.currentTarget.value })}
          />
        </InlineField>
        <IconButton name="trash-alt" tooltip="Remove binding" aria-label={`Remove binding ${n}`} onClick={onRemove} />
      </InlineFieldRow>
      <InlineField label="Source" labelWidth={LABEL_WIDTH} grow>
        <Select
          aria-label={`Source of binding ${n}`}
          options={SOURCES}
          value={binding.source}
          onChange={(v) => set({ source: v.value ?? 'static' })}
        />
      </InlineField>
      {(binding.source === 'field' || binding.source === 'series') && (
        <>
          <InlineField label="Frame" labelWidth={LABEL_WIDTH} tooltip="refId or name; empty for any frame" grow>
            <Input
              aria-label={`Frame of binding ${n}`}
              value={binding.frame ?? ''}
              placeholder="any"
              onChange={(e) => set({ frame: e.currentTarget.value })}
            />
          </InlineField>
          <InlineField
            label="Field"
            labelWidth={LABEL_WIDTH}
            tooltip="Name or display name; empty for the first number field"
            grow
          >
            <Input
              aria-label={`Field of binding ${n}`}
              value={binding.field ?? ''}
              placeholder="first number field"
              onChange={(e) => set({ field: e.currentTarget.value })}
            />
          </InlineField>
        </>
      )}
      {binding.source === 'field' && (
        <InlineField label="Reducer" labelWidth={LABEL_WIDTH} grow>
          <Select
            aria-label={`Reducer of binding ${n}`}
            options={reducerOptions()}
            value={binding.reducer ?? 'lastNotNull'}
            onChange={(v) => set({ reducer: v.value })}
          />
        </InlineField>
      )}
      {binding.source === 'static' && (
        <InlineField label="Value" labelWidth={LABEL_WIDTH} tooltip="JSON; other text is kept as a string" grow>
          <Input
            aria-label={`Value of binding ${n}`}
            defaultValue={jsonText(binding.value)}
            onBlur={(e) => set({ value: parseJsonOrText(e.currentTarget.value) })}
          />
        </InlineField>
      )}
      {binding.source === 'variable' && (
        <InlineFieldRow>
          <InlineField label="Variable" labelWidth={LABEL_WIDTH} grow>
            <Input
              aria-label={`Variable of binding ${n}`}
              value={binding.variable ?? ''}
              placeholder="name"
              onChange={(e) => set({ variable: e.currentTarget.value })}
            />
          </InlineField>
          <InlineField label="As">
            <Select
              aria-label={`Parse of binding ${n}`}
              options={PARSES}
              value={binding.parse ?? 'text'}
              onChange={(v) => set({ parse: v.value })}
              width={12}
            />
          </InlineField>
        </InlineFieldRow>
      )}
      {binding.source === 'time' && (
        <InlineFieldRow>
          <InlineField label="Time" labelWidth={LABEL_WIDTH} grow>
            <Select
              aria-label={`Time of binding ${n}`}
              options={TIMES}
              value={binding.time ?? 'range'}
              onChange={(v) => set({ time: v.value })}
            />
          </InlineField>
          <InlineField label="As">
            <Select
              aria-label={`Time format of binding ${n}`}
              options={TIME_FORMATS}
              value={binding.timeFormat ?? 'ms'}
              onChange={(v) => set({ timeFormat: v.value })}
              width={16}
            />
          </InlineField>
        </InlineFieldRow>
      )}
      <InlineFieldRow>
        <InlineField label="Write-back" labelWidth={LABEL_WIDTH} tooltip="Where a value saved by the widget goes">
          <Select
            aria-label={`Write-back of binding ${n}`}
            options={WRITE_BACKS}
            value={binding.writeBack ?? 'none'}
            onChange={(v) => set({ writeBack: v.value })}
            width={18}
          />
        </InlineField>
        {binding.writeBack === 'variable' && binding.source !== 'variable' && (
          <InlineField label="to" grow>
            <Input
              aria-label={`Write-back variable of binding ${n}`}
              value={binding.writeVariable ?? ''}
              placeholder="variable name"
              onChange={(e) => set({ writeVariable: e.currentTarget.value })}
            />
          </InlineField>
        )}
      </InlineFieldRow>
    </div>
  );
};

export const BindingsEditor: React.FC<StandardEditorProps<TraitBinding[]>> = ({ value, onChange }) => {
  const bindings = value ?? [];
  const update = (i: number, b: TraitBinding) => onChange(bindings.map((x, j) => (j === i ? b : x)));
  return (
    <div>
      {bindings.map((b, i) => (
        <BindingRow
          key={i}
          index={i}
          binding={b}
          onChange={(nb) => update(i, nb)}
          onRemove={() => onChange(bindings.filter((_, j) => j !== i))}
        />
      ))}
      <Button
        icon="plus"
        variant="secondary"
        size="sm"
        onClick={() => onChange([...bindings, { trait: '', source: 'field', reducer: 'lastNotNull' }])}
      >
        Add binding
      </Button>
    </div>
  );
};
