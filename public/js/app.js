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

// Kacheln aufbauen
const grid = $('#gauges');
for (const [key, p] of Object.entries(PIDS)) {
  grid.insertAdjacentHTML('beforeend', `
    <div class="gauge" id="g-${key}">
      <div class="label">${p.label}</div>
      <div class="value">–</div>
      <div class="unit">${p.unit}</div>
    </div>`);
}
const show = (key, v) => {
  const digits = key === 'voltage' ? 1 : 0;
  $(`#g-${key} .value`).textContent = v == null ? '–' : v.toFixed(digits);
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
