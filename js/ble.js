// Polar H10 BLE klients — STUB (pilnā implementācija 2. solī).
//
// Notikumi (abiem klientiem vienādi):
//   'hr'           { bpm: number, rr: number[] (ms), ts: number (Date.now()) }
//   'battery'      { level: number }   // 0..100
//   'connected'    { name: string }
//   'disconnected' {}
//
// BLE UUID (Heart Rate Service / Battery Service) — izmantos 2. solī.
export const HR_SERVICE = 0x180d;
export const HR_MEASUREMENT = 0x2a37;
export const BATTERY_SERVICE = 0x180f;
export const BATTERY_LEVEL = 0x2a19;

class Emitter {
  constructor() { this._handlers = new Map(); }
  on(event, fn) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(fn);
    return () => this.off(event, fn);
  }
  off(event, fn) { this._handlers.get(event)?.delete(fn); }
  emit(event, payload) { this._handlers.get(event)?.forEach((fn) => fn(payload)); }
}

export class HrmClient extends Emitter {
  constructor() {
    super();
    this.device = null;
    this.connected = false;
  }

  static isSupported() {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth;
  }

  async connect() {
    // TODO (2. solis): navigator.bluetooth.requestDevice({ filters: [{ services: [HR_SERVICE] }],
    //   optionalServices: [BATTERY_SERVICE] }) → gatt.connect() → HR_MEASUREMENT notifications
    //   → parsēt flags/bpm/RR → emit('hr'); BATTERY_LEVEL read + notify → emit('battery');
    //   gattserverdisconnected → emit('disconnected').
    throw new Error('HrmClient.connect: TODO (2. solis)');
  }

  async disconnect() {
    // TODO (2. solis): this.device?.gatt?.disconnect()
  }
}

export class MockHrm extends Emitter {
  constructor() {
    super();
    this.connected = false;
    this._timer = null;
  }

  async connect() {
    // TODO (3. solis): sintētisks pulss (sinusoīda + troksnis), RR ≈ 60000/bpm,
    //   emit('hr') reizi sekundē, 'battery' ik pa laikam, 'connected' uzreiz.
    throw new Error('MockHrm.connect: TODO (3. solis)');
  }

  async disconnect() {
    // TODO (3. solis): clearInterval + emit('disconnected')
  }
}
