// ELM327-Protokoll über einen beliebigen Transport (BLE, Demo, später WebSocket).
// Befehle laufen strikt nacheinander; eine Antwort endet mit dem Prompt ">".
export class Elm327 {
  constructor(transport, { timeout = 3000, log = () => {} } = {}) {
    this.t = transport;
    this.timeout = timeout;
    this.log = log;
    this.buf = '';
    this.pending = null;
    this.queue = Promise.resolve();
    transport.addEventListener('data', e => this.#onData(e.detail));
  }

  #onData(text) {
    this.buf += text;
    const end = this.buf.indexOf('>');
    if (end === -1 || !this.pending) return;
    const resp = this.buf.slice(0, end).replace(/\0/g, '').trim();
    this.buf = this.buf.slice(end + 1);
    const { resolve, timer } = this.pending;
    clearTimeout(timer);
    this.pending = null;
    resolve(resp);
  }

  send(cmd) {
    const run = () => new Promise((resolve, reject) => {
      this.buf = '';
      const timer = setTimeout(() => {
        this.pending = null;
        reject(new Error(`Timeout bei "${cmd}"`));
      }, this.timeout);
      this.pending = { resolve, timer };
      this.log('> ' + cmd);
      this.t.write(cmd + '\r').catch(err => { clearTimeout(timer); this.pending = null; reject(err); });
    }).then(r => { this.log('< ' + r.replace(/[\r\n]+/g, ' | ')); return r; });
    // Fehler eines Befehls sollen die Queue nicht blockieren
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  async init() {
    const r = await this.send('ATZ').catch(() => '');   // Reset (kann lange dauern)
    for (const c of ['ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0']) await this.send(c);
    return r;
  }
}
