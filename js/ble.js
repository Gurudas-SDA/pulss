// Polar H10 BLE klients (Web Bluetooth) + imitācija (MockHrm).
//
// Notikumi (abiem klientiem vienādi):
//   'hr'           { bpm: number, rr: number[] (ms), ts: number (Date.now()) }
//   'battery'      { level: number }   // 0..100
//   'connected'    { name: string }
//   'disconnected' {}
//   'status'       { text: string }    // statusa rinda UI (piem., atkārtota savienošanās)
//   'error'        { message: string } // galīga kļūda (piem., pārtraukta atkārtota savienošanās)
import { Emitter } from './emitter.js';
import { t, fill } from './i18n.js';

// BLE UUID (Heart Rate Service / Battery Service) — Web Bluetooth pieņem arī vārdiskos aliasus.
export const HR_SERVICE = 'heart_rate';                 // 0x180d
export const HR_MEASUREMENT = 'heart_rate_measurement'; // 0x2a37
export const BATTERY_SERVICE = 'battery_service';       // 0x180f
export const BATTERY_LEVEL = 'battery_level';           // 0x2a19

const BATTERY_POLL_MS = 5 * 60 * 1000;
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];
const RETRY_MAX_MS = 2 * 60 * 1000;

// Heart Rate Measurement raksturlieluma parsēšana (Bluetooth SIG HRS 1.0, 3.1).
// Tīra funkcija — testējama Node bez pārlūka.
export function parseHrMeasurement(dv) {
  const flags = dv.getUint8(0);
  const hr16 = (flags & 0x01) !== 0;
  const bpm = hr16 ? dv.getUint16(1, true) : dv.getUint8(1);
  let offset = hr16 ? 3 : 2;
  if (flags & 0x08) offset += 2; // Energy Expended (uint16) — izlaižam
  const rr = [];
  if (flags & 0x10) {
    while (offset + 1 < dv.byteLength) {
      rr.push(Math.round((dv.getUint16(offset, true) / 1024) * 1000)); // 1/1024 s → ms
      offset += 2;
    }
  }
  return { bpm, rr };
}

export class HrmClient extends Emitter {
  constructor() {
    super();
    this.device = null;
    this.connected = false;
    this._hrChar = null;
    this._batChar = null;
    this._batTimer = null;
    this._retryTimer = null;
    this._reconnecting = false;
    this._manualDisconnect = false;
    this._onGattDisconnected = () => this._handleDisconnect();
    this._onHrValue = (ev) => {
      try {
        const { bpm, rr } = parseHrMeasurement(ev.target.value);
        this.emit('hr', { bpm, rr, ts: Date.now() });
      } catch (e) { console.warn('HR parse failed', e); }
    };
    this._onBatValue = (ev) => {
      try { this.emit('battery', { level: ev.target.value.getUint8(0) }); } catch (_) { /* ignorē */ }
    };
  }

  static isSupported() {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth;
  }

  // Jāizsauc no lietotāja žesta (klikšķa) — citādi requestDevice tiek noraidīts.
  async connect() {
    if (!HrmClient.isSupported()) throw new Error(t.errors.noBluetooth);
    this._manualDisconnect = false;
    this._stopRetry();
    if (this.device) this.device.removeEventListener('gattserverdisconnected', this._onGattDisconnected);
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [HR_SERVICE] }],
      optionalServices: [BATTERY_SERVICE],
    });
    this.device.addEventListener('gattserverdisconnected', this._onGattDisconnected);
    await this._setup();
  }

  async _setup() {
    const server = await this.device.gatt.connect();
    const hrService = await server.getPrimaryService(HR_SERVICE);
    const hrChar = await hrService.getCharacteristic(HR_MEASUREMENT);
    if (this._hrChar && this._hrChar !== hrChar) {
      this._hrChar.removeEventListener('characteristicvaluechanged', this._onHrValue);
    }
    hrChar.addEventListener('characteristicvaluechanged', this._onHrValue);
    await hrChar.startNotifications();
    this._hrChar = hrChar;
    this.connected = true;
    await this._setupBattery(server);
    this.emit('connected', { name: this.device.name || 'Polar' });
  }

  async _setupBattery(server) {
    this._clearBatteryTimer();
    try {
      const svc = await server.getPrimaryService(BATTERY_SERVICE);
      const ch = await svc.getCharacteristic(BATTERY_LEVEL);
      this._batChar = ch;
      await this._readBattery();
      try {
        ch.addEventListener('characteristicvaluechanged', this._onBatValue);
        await ch.startNotifications();
      } catch (_) { /* paziņojumus neatbalsta — pietiek ar periodisku nolasīšanu */ }
      this._batTimer = setInterval(() => this._readBattery().catch(() => {}), BATTERY_POLL_MS);
    } catch (e) {
      console.warn('Battery service unavailable', e);
    }
  }

  async _readBattery() {
    if (!this._batChar || !this.connected) return;
    const dv = await this._batChar.readValue();
    this.emit('battery', { level: dv.getUint8(0) });
  }

  _clearBatteryTimer() {
    if (this._batTimer) { clearInterval(this._batTimer); this._batTimer = null; }
  }

  _stopRetry() {
    if (this._retryTimer) { clearTimeout(this._retryTimer); this._retryTimer = null; }
    this._reconnecting = false;
  }

  _handleDisconnect() {
    const wasConnected = this.connected;
    this.connected = false;
    this._clearBatteryTimer();
    if (wasConnected) this.emit('disconnected', {});
    if (this._manualDisconnect || this._reconnecting) return; // retry cikls jau rit vai lietotājs atvienoja
    this._reconnecting = true;
    this._retryStart = Date.now();
    this._retryAttempt = 0;
    this._scheduleRetry();
  }

  _scheduleRetry() {
    const delay = RETRY_DELAYS_MS[Math.min(this._retryAttempt, RETRY_DELAYS_MS.length - 1)];
    if (Date.now() - this._retryStart + delay > RETRY_MAX_MS) {
      this._reconnecting = false;
      this.emit('error', { message: t.ble.reconnectFailed });
      return;
    }
    this._retryTimer = setTimeout(async () => {
      this._retryTimer = null;
      if (this._manualDisconnect || !this.device) { this._reconnecting = false; return; }
      this._retryAttempt += 1;
      this.emit('status', { text: fill(t.ble.reconnecting, { n: this._retryAttempt }) });
      try {
        await this._setup();
        this._reconnecting = false;
      } catch (e) {
        console.warn('Reconnect attempt failed', e);
        if (!this._manualDisconnect) this._scheduleRetry();
        else this._reconnecting = false;
      }
    }, delay);
  }

  async disconnect() {
    this._manualDisconnect = true;
    this._stopRetry();
    this._clearBatteryTimer();
    const gatt = this.device && this.device.gatt;
    if (gatt && gatt.connected) {
      try { gatt.disconnect(); } catch (e) { console.warn(e); } // 'gattserverdisconnected' emitēs 'disconnected'
    } else if (this.connected) {
      this.connected = false;
      this.emit('disconnected', {});
    }
    this.connected = false;
  }
}

// Imitēta josta: sintētisks pulss (sinusoīdas + troksnis), baterija, atvienošanās simulācija.
export class MockHrm extends Emitter {
  constructor() {
    super();
    this.connected = false;
    this.name = t.ble.mockName;
    this._hrTimer = null;
    this._batDelay = null;
    this._batTimer = null;
    this._level = 73;
    this._t = 0;
    this._paused = false;
  }

  static isSupported() { return true; }

  async connect() {
    this._clearTimers();
    this.connected = true;
    this._paused = false;
    this.emit('connected', { name: this.name });
    this._batDelay = setTimeout(() => {
      this.emit('battery', { level: this._level });
      this._batTimer = setInterval(() => {
        this._level = Math.max(0, this._level - 1);
        this.emit('battery', { level: this._level });
      }, 60000);
    }, 300);
    this._hrTimer = setInterval(() => this._tick(), 1000);
  }

  _tick() {
    if (this._paused || !this.connected) return;
    this._t += 1;
    const tt = this._t;
    const noise = Math.round(Math.random() * 4) - 2;
    let bpm = Math.round(95 + 30 * Math.sin(tt / 40) + 8 * Math.sin(tt / 7) + noise);
    bpm = Math.max(50, Math.min(190, bpm));
    this.emit('hr', { bpm, rr: [Math.round(60000 / bpm)], ts: Date.now() });
  }

  // Testa ceļš UI: atvienojas, 3 s klusē, tad "atkārtoti savienojas".
  simulateDisconnect() {
    if (!this.connected) return;
    this.connected = false;
    this._paused = true;
    this.emit('disconnected', {});
    setTimeout(() => this.emit('status', { text: fill(t.ble.reconnecting, { n: 1 }) }), 500);
    setTimeout(() => {
      if (!this._hrTimer) return; // pa to laiku atvienots manuāli
      this._paused = false;
      this.connected = true;
      this.emit('connected', { name: this.name });
    }, 3000);
  }

  _clearTimers() {
    if (this._hrTimer) clearInterval(this._hrTimer);
    if (this._batTimer) clearInterval(this._batTimer);
    if (this._batDelay) clearTimeout(this._batDelay);
    this._hrTimer = this._batTimer = this._batDelay = null;
  }

  async disconnect() {
    this._clearTimers();
    const was = this.connected;
    this.connected = false;
    if (was) this.emit('disconnected', {});
  }
}

export function createClient(mock) {
  return mock ? new MockHrm() : new HrmClient();
}
