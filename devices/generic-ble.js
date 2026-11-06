// BLE explorer: connect to any Bluetooth device, list its services and
// characteristics, and log every notification as hex. Use it to work out
// how an unfamiliar meter sends its readings.
//
// Web Bluetooth only exposes services you name in advance, so this tries the
// known meter services plus any UUIDs you type into the "Extra service UUIDs"
// box (comma separated).
//
// As a guess, each notification is also decoded as a float32 at offset 0.
// If that looks like your distance in meters, it is spoken.

import { BleDriver, toHex } from './driver.js';
import { DISTO_SERVICE } from './leica-disto.js';
import { GLM_SERVICE } from './bosch-glm.js';
import { LIDAR_SERVICE } from './esp32-lidar.js';

const COMMON_SERVICES = [
  DISTO_SERVICE,
  GLM_SERVICE,
  LIDAR_SERVICE,
  'battery_service',
  'device_information',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART, used by many cheap meters
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 style serial module
  '0000fff0-0000-1000-8000-00805f9b34fb',
];

export class GenericBleDriver extends BleDriver {
  static label = 'BLE explorer (any device)';
  extraServices = [];

  requestOptions() {
    return {
      acceptAllDevices: true,
      optionalServices: [...COMMON_SERVICES, ...this.extraServices],
    };
  }

  async setup(server) {
    let services = [];
    try {
      services = await server.getPrimaryServices();
    } catch (e) {
      this.log(`No accessible services (${e.message}). Add the device's service UUID to the extra UUIDs box.`);
      return;
    }
    for (const service of services) {
      this.log(`Service ${service.uuid}`);
      const chars = await service.getCharacteristics().catch(() => []);
      for (const ch of chars) {
        const p = ch.properties;
        const props = ['read', 'write', 'writeWithoutResponse', 'notify', 'indicate'].filter((k) => p[k]);
        this.log(`  Characteristic ${ch.uuid} [${props.join(', ')}]`);
        if (p.read) {
          try {
            this.log(`    value: ${toHex(await ch.readValue())}`);
          } catch {
            /* some reads are refused; that's fine */
          }
        }
        if (p.notify || p.indicate) {
          ch.addEventListener('characteristicvaluechanged', (e) => {
            const v = e.target.value;
            let guess = '';
            if (v.byteLength >= 4) {
              const f = v.getFloat32(0, true);
              guess = ` (float32 at 0: ${f})`;
              if (Number.isFinite(f) && f > 0.01 && f < 300) this.emitMeasurement(f);
            }
            this.log(`Notify ${ch.uuid.slice(0, 8)}: ${toHex(v)}${guess}`);
          });
          await ch.startNotifications().catch((e) => this.log(`    could not subscribe: ${e.message}`));
        }
      }
    }
  }
}
