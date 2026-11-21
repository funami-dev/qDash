import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Elm327 } from '../public/js/elm327.js';
import { DemoTransport } from '../public/js/transport-demo.js';

test('Antworten werden über Chunks zusammengesetzt', async () => {
  const t = new EventTarget();
  t.write = async () => {
    for (const part of ['41 0C', ' 1A F8\r', '\r>'])
      setTimeout(() => t.dispatchEvent(new CustomEvent('data', { detail: part })), 1);
  };
  const elm = new Elm327(t);
  assert.equal(await elm.send('010C'), '41 0C 1A F8');
});

test('Init und Abfrage gegen Demo-Transport', async () => {
  const t = new DemoTransport();
  await t.connect();
  const elm = new Elm327(t);
  assert.match(await elm.init(), /ELM327/);
  assert.match(await elm.send('010C'), /^41 0C/);
});

test('Timeout blockiert Queue nicht', async () => {
  const t = new EventTarget();
  let n = 0;
  t.write = async () => { if (n++ > 0) setTimeout(() => t.dispatchEvent(new CustomEvent('data', { detail: 'OK>' })), 1); };
  const elm = new Elm327(t, { timeout: 50 });
  await assert.rejects(elm.send('ATZ'), /Timeout/);
  assert.equal(await elm.send('ATE0'), 'OK');
});
