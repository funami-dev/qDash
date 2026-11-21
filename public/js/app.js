import { Elm327 } from './elm327.js';
import { BleTransport } from './transport-ble.js';
import { DemoTransport } from './transport-demo.js';
import { PIDS, parseMode01, parseDTCs } from './pids.js';

const $ = s => document.querySelector(s);
const statusEl = $('#status');
const logEl = $('#log');
let elm = null, transport = null, polling = false;

function log(line) {
  logEl.textContent = (line + '\n' + logEl.textContent).slice(0, 4000);
}
function setStatus(text, state) {
  statusEl.textContent = text;
  document.body.dataset.state = state;
}

// Kacheln aufbauen; DIALS bekommen einen Rundzeiger (Bereich + roter Bereich)
const DIALS = { rpm: { max: 7000, red: 6000 }, speed: { max: 240 } };
const grid = $('#gauges');
for (const [key, p] of Object.entries(PIDS)) {
  grid.insertAdjacentHTML('beforeend', `
    <div class="gauge${DIALS[key] ? ' dial' : ''}" id="g-${key}">
      ${DIALS[key] ? dialSvg(DIALS[key]) : ''}
      <div class="label">${p.label}</div>
      <div class="value">–</div>
      <div class="unit">${p.unit}</div>
    </div>`);
}

// Halbkreis-Skala (270°), Länge der Bogenlinie = 100 → stroke-dasharray in Prozent
function dialSvg({ max, red }) {
  const arc = 'M 22 88 A 50 50 0 1 1 98 88';
  const redPart = red ? `<path d="${arc}" pathLength="100" class="dial-red"
    stroke-dasharray="${100 - (red / max) * 100} 100" stroke-dashoffset="${-(red / max) * 100}"/>` : '';
  return `<svg viewBox="0 0 120 105" aria-hidden="true">
    <path d="${arc}" pathLength="100" class="dial-track"/>
    ${redPart}
    <path d="${arc}" pathLength="100" class="dial-bar" stroke-dasharray="0 100"/>
  </svg>`;
}

const show = (key, v) => {
  const digits = key === 'voltage' ? 1 : 0;
  const el = $(`#g-${key}`);
  el.querySelector('.value').textContent = v == null ? '–' : v.toFixed(digits);
  const dial = DIALS[key];
  if (dial) {
    const pct = v == null ? 0 : Math.min(100, Math.max(0, (v / dial.max) * 100));
    el.querySelector('.dial-bar').setAttribute('stroke-dasharray', `${pct} 100`);
    el.classList.toggle('redline', dial.red != null && v >= dial.red);
  }
};

async function connect(useDemo) {
  try {
    transport = useDemo ? new DemoTransport() : new BleTransport();
    setStatus('Verbinde …', 'busy');
    const name = await transport.connect();
    transport.addEventListener('disconnect', () => { polling = false; setStatus('Getrennt', 'off'); });
    elm = new Elm327(transport, { log });
    setStatus('Initialisiere …', 'busy');
    const id = await elm.init();
    setStatus(`${name} · ${id || 'ELM327'}`, 'on');
    poll();
  } catch (err) {
    setStatus(err.message, 'error');
    log('! ' + err.message);
  }
}

// Unterstützte PIDs, die mit NO DATA antworten, werden nach 3 Fehlversuchen übersprungen
const misses = {};
async function poll() {
  polling = true;
  while (polling) {
    for (const [key, p] of Object.entries(PIDS)) {
      if (!polling) break;
      if ((misses[key] ?? 0) >= 3) continue;
      try {
        const raw = await elm.send('01' + p.pid);
        const data = parseMode01(raw, p.pid, p.bytes);
        if (data) { misses[key] = 0; show(key, p.decode(data)); }
        else { misses[key] = (misses[key] ?? 0) + 1; show(key, null); }
      } catch (err) {
        log('! ' + err.message);
      }
    }
  }
}

async function readDTCs() {
  if (!elm) return;
  const raw = await elm.send('03');
  const codes = parseDTCs(raw);
  $('#dtcs').textContent = codes.length ? codes.join(', ') : 'Keine Fehlercodes';
}

$('#connect').addEventListener('click', () => connect(false));
$('#demo').addEventListener('click', () => connect(true));
$('#disconnect').addEventListener('click', () => { polling = false; transport?.disconnect(); });
$('#read-dtc').addEventListener('click', () => readDTCs().catch(e => log('! ' + e.message)));

if (!BleTransport.supported()) {
  $('#connect').disabled = true;
  setStatus('Kein Web Bluetooth in diesem Browser (Chrome/Edge auf Android oder Desktop nutzen)', 'error');
}

// Bildschirm wach halten, solange verbunden
let wakeLock = null;
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && polling && 'wakeLock' in navigator)
    wakeLock = await navigator.wakeLock.request('screen').catch(() => null);
});
statusEl.addEventListener('click', async () => {
  if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen').catch(() => null);
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
