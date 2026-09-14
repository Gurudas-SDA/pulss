// Minimāls notikumu emitētājs (kopīgs ble.js un recorder.js).
// on() atgriež atrakstīšanās funkciju; emit() kļūdas klausītājos izolē (viens klausītājs
// nedrīkst nogremdēt pārējos).
export class Emitter {
  constructor() { this._handlers = new Map(); }

  on(event, fn) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) { this._handlers.get(event)?.delete(fn); }

  emit(event, payload) {
    const set = this._handlers.get(event);
    if (!set) return;
    for (const fn of Array.from(set)) {
      try { fn(payload); } catch (e) { console.error(`Emitter '${event}' handler failed`, e); }
    }
  }
}
