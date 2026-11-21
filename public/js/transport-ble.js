// BLE-Transport für MeatPi WiCAN (Firmware: main/ble.c)
// Service 0xFEE0, Characteristic 0xFEE1 = Schreiben (Befehle) + Notify (Antworten).
// Verbindung ist verschlüsselt: beim ersten Mal fragt das OS nach dem Passkey
// aus der WiCAN-Konfiguration.
const SERVICE = 0xfee0;
const DATA_CHAR = 0xfee1;
const CHUNK = 20; // ohne MTU-Aushandlung (Web Bluetooth kann das nicht steuern)

export class BleTransport extends EventTarget {
  static supported() { return 'bluetooth' in navigator; }

  async connect() {
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE] }],
      optionalServices: [SERVICE],
    });
    this.device.addEventListener('gattserverdisconnected', () =>
      this.dispatchEvent(new Event('disconnect')));
    const server = await this.device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE);
    this.char = await service.getCharacteristic(DATA_CHAR);
    this.char.addEventListener('characteristicvaluechanged', e => {
      const text = new TextDecoder().decode(e.target.value);
      this.dispatchEvent(new CustomEvent('data', { detail: text }));
    });
    await this.char.startNotifications(); // löst ggf. das Pairing aus
    return this.device.name || 'WiCAN';
  }

  async write(text) {
    const bytes = new TextEncoder().encode(text);
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const part = bytes.slice(i, i + CHUNK);
      if (this.char.writeValueWithResponse) await this.char.writeValueWithResponse(part);
      else await this.char.writeValue(part);
    }
  }

  disconnect() { this.device?.gatt?.connected && this.device.gatt.disconnect(); }
}
