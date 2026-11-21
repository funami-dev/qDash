// OBD-II Mode 01 PIDs, die das Dashboard abfragt.
// decode() bekommt die Datenbytes NACH "41 <pid>" (A, B, ...).
export const PIDS = {
  rpm:     { pid: '0C', label: 'Drehzahl',    unit: 'U/min', bytes: 2, decode: ([a, b]) => (a * 256 + b) / 4 },
  speed:   { pid: '0D', label: 'Tempo',       unit: 'km/h',  bytes: 1, decode: ([a]) => a },
  coolant: { pid: '05', label: 'Kühlmittel',  unit: '°C',    bytes: 1, decode: ([a]) => a - 40 },
  load:    { pid: '04', label: 'Last',        unit: '%',     bytes: 1, decode: ([a]) => (a * 100) / 255 },
  intake:  { pid: '0F', label: 'Ansaugluft',  unit: '°C',    bytes: 1, decode: ([a]) => a - 40 },
  throttle:{ pid: '11', label: 'Drossel',     unit: '%',     bytes: 1, decode: ([a]) => (a * 100) / 255 },
  voltage: { pid: '42', label: 'Spannung',    unit: 'V',     bytes: 2, decode: ([a, b]) => (a * 256 + b) / 1000 },
};

/**
 * Parst eine ELM327-Antwort auf "01<pid>" und liefert die Datenbytes oder null.
 * Kommt mit/ohne Leerzeichen, Echo, "SEARCHING...", mehreren Steuergeräten klar.
 */
export function parseMode01(raw, pid, bytes) {
  const lines = raw.toUpperCase().split(/[\r\n]+/).map(l => l.replace(/\s+/g, ''));
  const marker = '41' + pid.toUpperCase();
  for (const line of lines) {
    const i = line.indexOf(marker);
    if (i === -1) continue;
    const hex = line.slice(i + marker.length, i + marker.length + bytes * 2);
    if (hex.length < bytes * 2 || /[^0-9A-F]/.test(hex)) continue;
    const out = [];
    for (let k = 0; k < hex.length; k += 2) out.push(parseInt(hex.slice(k, k + 2), 16));
    return out;
  }
  return null;
}

/** Fehlercodes aus Mode-03-Antwort ("43 01 33 00 00 ..."), ohne CAN-Header. */
export function parseDTCs(raw) {
  const hex = raw.toUpperCase().split(/[\r\n]+/)
    .map(l => l.replace(/\s+/g, ''))
    .filter(l => l.startsWith('43'))
    .map(l => l.slice(2))
    .join('');
  // Bei CAN steht nach 43 noch die Anzahl der Codes (1 Byte)
  const body = hex.length % 4 === 2 ? hex.slice(2) : hex;
  const codes = [];
  for (let i = 0; i + 4 <= body.length; i += 4) {
    const word = body.slice(i, i + 4);
    if (word === '0000') continue;
    const first = parseInt(word[0], 16);
    const letter = 'PCBU'[first >> 2];
    codes.push(letter + (first & 3) + word.slice(1));
  }
  return codes;
}
