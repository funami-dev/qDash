# qDash

OBD2-Dashboard als PWA für den [MeatPi WiCAN](https://github.com/meatpiHQ/wican-fw) – verbindet sich per **Web Bluetooth (BLE)** und spricht ELM327.

## Starten

```sh
npm start      # http://localhost:8080
npm test
```

Ohne Adapter: **Demo** drücken, dann laufen simulierte Werte.

## WiCAN einrichten

1. In der WiCAN-Weboberfläche den Modus auf **BLE** und das Protokoll auf **ELM327** stellen und den **Passkey** notieren.
2. In qDash auf **WiCAN verbinden** tippen und das Gerät wählen. Beim ersten Mal fragt das Betriebssystem nach dem Passkey.

Technisch: Service `0xFEE0`, Characteristic `0xFEE1` (Write + Notify), verschlüsselt mit Bonding (Quelle: `main/ble.c` der Firmware).

## Browser

| Plattform | Status |
|---|---|
| Android (Chrome/Edge) | ✅ |
| Windows/macOS/Linux (Chrome/Edge) | ✅ |
| iOS/iPadOS | ❌ kein Web Bluetooth in Safari – Notlösung: Browser „Bluefy“ |

Web Bluetooth braucht einen *secure context*: `localhost` oder HTTPS. Fürs Handy also z. B. über GitHub Pages ausliefern oder per `chrome://inspect` Port-Forwarding nutzen.

## Aufbau

```
public/
  index.html, styles.css, manifest.webmanifest, sw.js, icon.svg
  js/app.js             UI + Polling-Schleife
  js/elm327.js          Befehlsqueue, Antwort bis ">" sammeln, Init (ATZ, ATE0, ATSP0 …)
  js/pids.js            Mode-01-PIDs + Dekodierung, Fehlercodes (Mode 03)
  js/transport-ble.js   WiCAN über Web Bluetooth
  js/transport-demo.js  simulierter ELM327
server.mjs              statischer Dev-Server ohne Abhängigkeiten
```

Weitere Werte: Eintrag in `PIDS` in `js/pids.js` ergänzen. Ein weiterer Transport (z. B. WebSocket) muss nur `connect()`, `write()` und `data`-Events liefern.
