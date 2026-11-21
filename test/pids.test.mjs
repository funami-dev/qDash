import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PIDS, parseMode01, parseDTCs } from '../public/js/pids.js';

test('Drehzahl mit Leerzeichen', () => {
  const d = parseMode01('41 0C 1A F8', '0C', 2);
  assert.equal(PIDS.rpm.decode(d), 1726);
});
test('Drehzahl ohne Leerzeichen, mit SEARCHING und Echo', () => {
  const d = parseMode01('010C\rSEARCHING...\r410C0FA0', '0C', 2);
  assert.equal(PIDS.rpm.decode(d), 1000);
});
test('NO DATA liefert null', () => {
  assert.equal(parseMode01('NO DATA', '0D', 1), null);
});
test('Kühlmittel', () => {
  assert.equal(PIDS.coolant.decode(parseMode01('41057B', '05', 1)), 83);
});
test('Fehlercodes CAN', () => {
  assert.deepEqual(parseDTCs('43 02 01 33 C1 23'), ['P0133', 'U0123']);
});
test('Keine Fehlercodes', () => {
  assert.deepEqual(parseDTCs('43 00'), []);
});
