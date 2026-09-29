// Editor of the static traits, a JSON object (PNL-005, PNL-006).
import React, { useState } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { Alert, TextArea } from '@grafana/ui';
import { parseStaticTraits } from '../afm/options';

export const StaticTraitsEditor: React.FC<StandardEditorProps<string>> = ({ value, onChange }) => {
  const [text, setText] = useState(value ?? '{}');
  // Follow external changes of the value (e.g. write-back to the panel options).
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText(value ?? '{}');
  }
  const parsed = parseStaticTraits(text);
  return (
    <div>
      <TextArea
        aria-label="Static traits (JSON)"
        rows={6}
        spellCheck={false}
        style={{ fontFamily: 'monospace' }}
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        onBlur={() => onChange(text)}
      />
      {!parsed.ok && (
        <Alert severity="warning" title="Static traits">
          {parsed.error}
        </Alert>
      )}
    </div>
  );
};
