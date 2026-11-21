// Simulierter ELM327 zum Testen ohne Auto/Adapter.
export class DemoTransport extends EventTarget {
  async connect() { this.t0 = Date.now(); return 'Demo'; }
  disconnect() { this.dispatchEvent(new Event('disconnect')); }

  async write(text) {
    const cmd = text.trim().toUpperCase().replace(/\s+/g, '');
    const t = (Date.now() - this.t0) / 1000;
    const hex = (n, len) => Math.max(0, Math.round(n)).toString(16).toUpperCase().padStart(len, '0').match(/../g).join(' ');
    const rpm = 900 + 2200 * (0.5 + 0.5 * Math.sin(t / 3));
    const answers = {
      '010C': '41 0C ' + hex(rpm * 4, 4),
      '010D': '41 0D ' + hex(rpm / 40, 2),
      '0105': '41 05 ' + hex(40 + Math.min(90, t * 2), 2),
      '0104': '41 04 ' + hex(80 + 60 * Math.sin(t), 2),
      '010F': '41 0F ' + hex(65, 2),
      '0111': '41 11 ' + hex(40 + 30 * Math.sin(t / 2), 2),
      '0142': '41 42 ' + hex(14100 + 100 * Math.sin(t), 4),
      '03': '43 01 01 33 00 00',
      '04': '44',
      'ATZ': 'ELM327 v2.3',
      'ATI': 'ELM327 v2.3',
      'ATDP': 'AUTO, ISO 15765-4 (CAN 11/500)',
    };
    const reply = answers[cmd] ?? (cmd.startsWith('AT') ? 'OK' : 'NO DATA');
    setTimeout(() => this.dispatchEvent(new CustomEvent('data', { detail: reply + '\r\r>' })), 15);
  }
}
