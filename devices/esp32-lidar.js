// ESP32 + TF-Luna / TFmini-S LiDAR, using the firmware in firmware/lidar-ble/.
//
// SKETCH: matches that firmware, but neither has been run on hardware yet.
//
// The device streams about 50 readings a second, which is what tone mode
// needs for real-time scanning.
//
//   Service          2bb8a36a-863a-4b3a-b494-828a89dafdb8
//   Reading (notify) 9a61290c-d108-406a-9ce2-10a133f5d5b8
//     uint16 LE  distance in mm, 0 = no target
//     uint16 LE  signal strength

import { BleDriver } from './driver.js';

export const LIDAR_SERVICE = '2bb8a36a-863a-4b3a-b494-828a89dafdb8';
const READING_CHAR = '9a61290c-d108-406a-9ce2-10a133f5d5b8';

export class Esp32LidarDriver extends BleDriver {
  static label = 'ESP32 LiDAR (Bluetooth, real-time)';
  // "Measure" speaks the latest streamed reading.
  canTrigger = true;
  latest = null;
  count = 0;
  rateTimer = null;

  requestOptions() {
    return {
      filters: [{ namePrefix: 'FBLidar' }, { services: [LIDAR_SERVICE] }],
      optionalServices: [LIDAR_SERVICE],
    };
  }

  async setup(server) {
    const service = await server.getPrimaryService(LIDAR_SERVICE);
    const ch = await service.getCharacteristic(READING_CHAR);
    ch.addEventListener('characteristicvaluechanged', (e) => {
      const v = e.target.value;
      if (v.byteLength < 4) return;
      const mm = v.getUint16(0, true);
      // Infinity = no target: the app falls silent rather than guessing.
      const meters = mm === 0 ? Infinity : mm / 1000;
      this.latest = meters;
      this.count++;
      this.emitMeasurement(meters, { streamed: true });
    });
    await ch.startNotifications();

    // Log the actual reading rate every 5 s, to check the link keeps up.
    clearInterval(this.rateTimer);
    this.count = 0;
    this.rateTimer = setInterval(() => {
      this.log(`LiDAR: ${(this.count / 5).toFixed(0)} readings a second`);
      this.count = 0;
    }, 5000);
  }

  async triggerMeasure() {
    if (this.latest !== null) this.emitMeasurement(this.latest);
  }

  async disconnect() {
    clearInterval(this.rateTimer);
    await super.disconnect();
  }
}
