import type { AnyModel } from '@anywidget/types';
import { AfmModel, Traits } from './model';

describe('AfmModel', () => {
  it('conforms to the AnyModel type of @anywidget/types (MOD-001)', () => {
    const model: AnyModel<{ value: number }> = new AfmModel({ value: 1 });
    expect(model.get('value')).toBe(1);
    expect(typeof model.widget_manager.get_model).toBe('function');
  });

  describe('get and set', () => {
    it('returns undefined for a missing trait', () => {
      const model = new AfmModel<Record<string, unknown>>({});
      expect(model.get('missing')).toBeUndefined();
    });

    it('stores a value and fires change:<trait> then change (MOD-002)', () => {
      const model = new AfmModel({ value: 1 });
      const calls: string[] = [];
      model.on('change:value', () => calls.push(`change:value=${model.get('value')}`));
      model.on('change', () => calls.push('change'));
      model.set('value', 2);
      expect(model.get('value')).toBe(2);
      expect(calls).toEqual(['change:value=2', 'change']);
    });

    it('calls change:<trait> handlers without arguments', () => {
      const model = new AfmModel({ value: 1 });
      const handler = jest.fn();
      model.on('change:value', handler);
      model.set('value', 2);
      expect(handler).toHaveBeenCalledWith();
    });

    it('fires nothing when the value is structurally equal (MOD-003)', () => {
      const model = new AfmModel({ list: [1, { a: 2 }], n: Number.NaN });
      const handler = jest.fn();
      model.on('change:list', handler);
      model.on('change:n', handler);
      model.set('list', [1, { a: 2 }]);
      model.set('n', Number.NaN);
      expect(handler).not.toHaveBeenCalled();
    });

    it('fires when a nested value differs', () => {
      const model = new AfmModel({ obj: { a: [1, 2] } });
      const handler = jest.fn();
      model.on('change:obj', handler);
      model.set('obj', { a: [1, 3] });
      model.set('obj', { a: [1, 3], b: 1 } as { a: number[] });
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('save_changes', () => {
    it('does not notify the host before save_changes (MOD-004)', () => {
      const onSave = jest.fn();
      const model = new AfmModel({ value: 1 }, { onSave });
      model.set('value', 2);
      expect(onSave).not.toHaveBeenCalled();
    });

    it('passes the traits changed since the last save, latest values only (MOD-005)', () => {
      const onSave = jest.fn();
      const model = new AfmModel({ a: 1, b: 1, c: 1 }, { onSave });
      model.set('a', 2);
      model.set('a', 3);
      model.set('b', 5);
      model.save_changes();
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith({ a: 3, b: 5 });
      model.save_changes();
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('keeps a trait set back to its saved value in the queue', () => {
      const onSave = jest.fn();
      const model = new AfmModel({ a: 1 }, { onSave });
      model.set('a', 2);
      model.set('a', 1);
      model.save_changes();
      expect(onSave).toHaveBeenCalledWith({ a: 1 });
    });

    it('passes copies, so later changes do not alter what the host received', () => {
      const onSave = jest.fn();
      const model = new AfmModel({ list: [1] }, { onSave });
      const list = [2];
      model.set('list', list);
      model.save_changes();
      list.push(3);
      expect(onSave.mock.calls[0][0]).toEqual({ list: [2] });
    });

    it('works without a host', () => {
      const model = new AfmModel({ a: 1 });
      model.set('a', 2);
      expect(() => model.save_changes()).not.toThrow();
    });
  });

  describe('host updates', () => {
    it('fires the change events without queuing the traits (MOD-006)', () => {
      const onSave = jest.fn();
      const model = new AfmModel({ a: 1, b: 1 }, { onSave });
      const calls: string[] = [];
      model.on('change:a', () => calls.push('a'));
      model.on('change:b', () => calls.push('b'));
      model.on('change', () => calls.push('change'));
      model.update({ a: 2, b: 3 });
      expect(calls).toEqual(['a', 'b', 'change']);
      model.save_changes();
      expect(onSave).not.toHaveBeenCalled();
    });

    it('fires nothing for unchanged traits', () => {
      const model = new AfmModel({ a: 1 });
      const handler = jest.fn();
      model.on('change', handler);
      model.update({ a: 1 });
      expect(handler).not.toHaveBeenCalled();
    });

    it('does not drop a pending widget change on another trait', () => {
      const onSave = jest.fn();
      const model = new AfmModel({ a: 1, b: 1 }, { onSave });
      model.set('a', 2);
      model.update({ b: 5 });
      model.save_changes();
      expect(onSave).toHaveBeenCalledWith({ a: 2 });
    });
  });

  describe('off (MOD-007)', () => {
    it('removes one callback of one event', () => {
      const model = new AfmModel({ a: 1 });
      const h1 = jest.fn();
      const h2 = jest.fn();
      model.on('change:a', h1);
      model.on('change:a', h2);
      model.off('change:a', h1);
      model.set('a', 2);
      expect(h1).not.toHaveBeenCalled();
      expect(h2).toHaveBeenCalled();
    });

    it('removes every callback of an event', () => {
      const model = new AfmModel({ a: 1 });
      const h1 = jest.fn();
      const h2 = jest.fn();
      model.on('change:a', h1);
      model.on('change', h2);
      model.off('change:a');
      model.set('a', 2);
      expect(h1).not.toHaveBeenCalled();
      expect(h2).toHaveBeenCalled();
    });

    it('removes a callback from every event when the event is null', () => {
      const model = new AfmModel({ a: 1 });
      const h = jest.fn();
      model.on('change:a', h);
      model.on('change', h);
      model.off(null, h);
      model.set('a', 2);
      expect(h).not.toHaveBeenCalled();
    });

    it('removes everything without arguments', () => {
      const model = new AfmModel({ a: 1 });
      model.on('change:a', jest.fn());
      model.on('msg:custom', jest.fn());
      expect(model.listenerCount()).toBe(2);
      model.off();
      expect(model.listenerCount()).toBe(0);
    });

    it('lets a handler remove itself while the event is being fired', () => {
      const model = new AfmModel({ a: 1 });
      const later = jest.fn();
      const once = () => model.off('change:a', once);
      model.on('change:a', once);
      model.on('change:a', later);
      model.set('a', 2);
      expect(later).toHaveBeenCalledTimes(1);
      expect(model.listenerCount()).toBe(1);
    });
  });

  describe('send and custom messages', () => {
    it('routes content and buffers to the host (MOD-008)', () => {
      const onSend = jest.fn();
      const model = new AfmModel({}, { onSend });
      const bytes = new Uint8Array([1, 2, 3]);
      model.send({ type: 'click' }, undefined, [bytes]);
      expect(onSend).toHaveBeenCalledTimes(1);
      const [content, buffers] = onSend.mock.calls[0];
      expect(content).toEqual({ type: 'click' });
      expect(buffers).toHaveLength(1);
      expect(buffers[0]).toBeInstanceOf(DataView);
      expect(buffers[0].getUint8(2)).toBe(3);
    });

    it('accepts Jupyter-style callbacks and never calls them, since no kernel replies', () => {
      const onSend = jest.fn();
      const model = new AfmModel({}, { onSend });
      const callbacks = { shell: { reply: jest.fn() }, iopub: { status: jest.fn() } };
      model.send({ type: 'x' }, callbacks);
      expect(onSend).toHaveBeenCalledWith({ type: 'x' }, []);
      expect(callbacks.shell.reply).not.toHaveBeenCalled();
      expect(callbacks.iopub.status).not.toHaveBeenCalled();
    });

    it('fires msg:custom with the content and DataView buffers (MOD-009)', () => {
      const model = new AfmModel({});
      const handler = jest.fn();
      model.on('msg:custom', handler);
      model.emitCustom({ type: 'snapshot' }, [new Float32Array([1.5]).buffer]);
      const [msg, buffers] = handler.mock.calls[0];
      expect(msg).toEqual({ type: 'snapshot' });
      expect(buffers[0]).toBeInstanceOf(DataView);
      expect(buffers[0].getFloat32(0, true)).toBe(1.5);
    });

    it('keeps the view window of a typed array buffer', () => {
      const model = new AfmModel({});
      const handler = jest.fn();
      model.on('msg:custom', handler);
      const whole = new Uint8Array([9, 8, 7, 6]);
      model.emitCustom({}, [whole.subarray(2)]);
      const view: DataView = handler.mock.calls[0][1][0];
      expect(view.byteLength).toBe(2);
      expect(view.getUint8(0)).toBe(7);
    });
  });

  describe('robustness', () => {
    it('logs a throwing handler and still calls the others (MOD-010)', () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      const model = new AfmModel({ a: 1 });
      const after = jest.fn();
      model.on('change:a', () => {
        throw new Error('boom');
      });
      model.on('change:a', after);
      model.set('a', 2);
      expect(after).toHaveBeenCalled();
      expect(error).toHaveBeenCalled();
      error.mockRestore();
    });

    it('rejects widget_manager.get_model with a clear error (MOD-011)', async () => {
      const model = new AfmModel({});
      await expect(model.widget_manager.get_model('abc')).rejects.toThrow(/no widget manager/i);
    });

    it('returns a snapshot of all traits', () => {
      const model = new AfmModel<Traits>({ a: 1 });
      model.set('a', 2);
      model.update({ b: 3 });
      expect(model.snapshot()).toEqual({ a: 2, b: 3 });
    });
  });
});
