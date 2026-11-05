// Leica DISTO Bluetooth Low Energy driver (D1, D110, D2, X3, X4, ...).
//
// These UUIDs come from community documentation of the DISTO BLE protocol.
// They have NOT been checked against a real device yet. Once you have a
// meter, use the "BLE explorer" source to confirm them.
//
//   Service      3ab10100-f831-4395-b29d-570977d5bf94
//   Distance     3ab10101-...  indicate/notify, float32 little-endian, meters
//   Unit         3ab10102-...  (the unit shown on the meter's screen; ignored here)
//   Command      3ab10109-...  write ASCII "g" to take a measurement (on models that support it)

import { BleDriver, toHex } from './driver.js';

export const DISTO_SERVICE = '3ab10100-f831-4395-b29d-570977d5bf94';
const DISTANCE_CHAR = '3ab10101-f831-4395-b29d-570977d5bf94';
const COMMAND_CHAR = '3ab10109-f831-4395-b29d-570977d5bf94';

export class LeicaDistoDriver extends BleDriver {
  static label = 'Leica DISTO (Bluetooth)';
  commandChar = null;

  requestOptions() {
    return {
      filters: [{ namePrefix: 'DISTO' }, { services: [DISTO_SERVICE] }],
      optionalServices: [DISTO_SERVICE],
    };
  }

  async setup(server) {
    const service = await server.getPrimaryService(DISTO_SERVICE);

    const distance = await service.getCharacteristic(DISTANCE_CHAR);
    distance.addEventListener('characteristicvaluechanged', (e) => {
      const v = e.target.value;
      this.log(`DISTO distance bytes: ${toHex(v)}`);
      if (v.byteLength < 4) return;
      const meters = v.getFloat32(0, true);
      if (Number.isFinite(meters)) this.emitMeasurement(meters);
    });
    await distance.startNotifications();

    try {
      this.commandChar = await service.getCharacteristic(COMMAND_CHAR);
      this.canTrigger = true;
    } catch {
      this.commandChar = null;
      this.canTrigger = false;
      this.log('This DISTO has no command characteristic. Use the button on the meter.');
    }
  }

  async triggerMeasure() {
    if (!this.commandChar) return;
    await this.commandChar.writeValue(new TextEncoder().encode('g'));
  }
}
