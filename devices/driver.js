// Base class for every measurement source (simulator or real device).
//
// Events (listen with driver.addEventListener):
//   'measurement'  detail: { meters: number, streamed: boolean }
//                  meters is Infinity when the device sees no target.
//                  streamed = part of a fast continuous stream (not spoken in speech mode).
//   'status'       detail: { state: 'disconnected'|'connecting'|'connected'|'error', message: string }
//   'log'          detail: { message: string }   (debug output, shown in the log panel)

export class Driver extends EventTarget {
  // Human-readable name shown in the source picker.
  static label = 'Driver';
  // True if the driver can ask the device to take a measurement.
  canTrigger = false;
  state = 'disconnected';

  async connect() {}
  async disconnect() {}
  async triggerMeasure() {}

  emitMeasurement(meters, { streamed = false } = {}) {
    this.dispatchEvent(new CustomEvent('measurement', { detail: { meters, streamed } }));
  }

  setStatus(state, message = '') {
    this.state = state;
    this.dispatchEvent(new CustomEvent('status', { detail: { state, message } }));
  }

  log(message) {
    this.dispatchEvent(new CustomEvent('log', { detail: { message } }));
  }
}

export const bluetoothSupported = typeof navigator !== 'undefined' && !!navigator.bluetooth;

export function toHex(dataView) {
  return [...new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

// Shared Web Bluetooth plumbing: pick a device, connect, and reconnect
// automatically if the link drops (until the user presses Disconnect).
export class BleDriver extends Driver {
  device = null;
  server = null;
  userDisconnected = false;

  // Subclasses provide these.
  requestOptions() {
    throw new Error('requestOptions() not implemented');
  }
  async setup(_server) {}

  async connect() {
    if (!bluetoothSupported) {
      throw new Error('Web Bluetooth is not available in this browser. Use Chrome on Android or desktop.');
    }
    this.userDisconnected = false;
    this.setStatus('connecting', 'Choose your device');
    this.device = await navigator.bluetooth.requestDevice(this.requestOptions());
    this.device.addEventListener('gattserverdisconnected', () => this.onDropped());
    await this.open();
  }

  async open() {
    this.setStatus('connecting', `Connecting to ${this.device.name || 'device'}`);
    this.server = await this.device.gatt.connect();
    await this.setup(this.server);
    this.setStatus('connected', `Connected to ${this.device.name || 'device'}`);
  }

  async onDropped() {
    if (this.userDisconnected) return;
    this.setStatus('connecting', 'Connection lost. Reconnecting');
    for (let attempt = 1; attempt <= 5 && !this.userDisconnected; attempt++) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      if (this.userDisconnected) return;
      try {
        await this.open();
        return;
      } catch (e) {
        this.log(`Reconnect attempt ${attempt} failed: ${e.message}`);
      }
    }
    if (!this.userDisconnected) this.setStatus('disconnected', 'Disconnected');
  }

  async disconnect() {
    this.userDisconnected = true;
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    this.setStatus('disconnected', 'Disconnected');
  }
}
