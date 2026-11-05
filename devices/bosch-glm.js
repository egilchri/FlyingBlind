// Bosch GLM "C" series driver (GLM 50C, 100C, 50-27 CG, ...).
//
// Based on community reverse engineering of the Bosch protocol. NOT yet
// verified with a real meter. Use the "BLE explorer" source to check it.
//
//   Service / characteristic  02a6c0d0 / 02a6c0d1-0451-4000-b000-fb3210111989
//   Write C0 55 02 01 00 1A to turn on "auto sync", so every measurement
//   taken on the meter is sent as a notification.
//   Measurement notification: starts C0 55 10, distance is float32 LE
//   at byte 7, in meters.

import { BleDriver, toHex } from './driver.js';

export const GLM_SERVICE = '02a6c0d0-0451-4000-b000-fb3210111989';
const GLM_CHAR = '02a6c0d1-0451-4000-b000-fb3210111989';
const ENABLE_AUTO_SYNC = new Uint8Array([0xc0, 0x55, 0x02, 0x01, 0x00, 0x1a]);

export class BoschGlmDriver extends BleDriver {
  static label = 'Bosch GLM (Bluetooth)';

  requestOptions() {
    return {
      filters: [{ namePrefix: 'Bosch' }, { namePrefix: 'GLM' }, { services: [GLM_SERVICE] }],
      optionalServices: [GLM_SERVICE],
    };
  }

  async setup(server) {
    const service = await server.getPrimaryService(GLM_SERVICE);
    const ch = await service.getCharacteristic(GLM_CHAR);
    ch.addEventListener('characteristicvaluechanged', (e) => {
      const v = e.target.value;
      this.log(`GLM bytes: ${toHex(v)}`);
      if (v.byteLength >= 11 && v.getUint8(0) === 0xc0 && v.getUint8(1) === 0x55 && v.getUint8(2) === 0x10) {
        const meters = v.getFloat32(7, true);
        if (Number.isFinite(meters) && meters > 0) this.emitMeasurement(meters);
      }
    });
    await ch.startNotifications();
    await ch.writeValue(ENABLE_AUTO_SYNC);
    this.log('Auto sync enabled. Take measurements with the button on the meter.');
  }
}
