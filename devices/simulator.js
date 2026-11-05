// A pretend laser meter, so the app can be built and tried without hardware.
//
// - triggerMeasure() produces one reading, like pressing the meter's button.
// - Auto mode streams readings every few seconds, drifting slowly as if the
//   user were walking toward or away from a wall.

import { Driver } from './driver.js';

export class SimulatorDriver extends Driver {
  static label = 'Simulator (no device)';
  canTrigger = true;
  canAuto = true;

  distance = 3.0;
  timer = null;

  async connect() {
    this.setStatus('connected', 'Simulator ready');
  }

  async disconnect() {
    this.setAuto(false);
    this.setStatus('disconnected', 'Simulator stopped');
  }

  async triggerMeasure() {
    if (this.state !== 'connected') return;
    // Mostly small changes, occasionally a jump to a new target.
    if (Math.random() < 0.25) {
      this.distance = 0.3 + Math.random() * 12;
    } else {
      this.distance = Math.max(0.05, this.distance + (Math.random() - 0.5) * 0.6);
    }
    // Real meters report to the millimeter.
    const meters = Math.round(this.distance * 1000) / 1000;
    this.log(`Simulated reading ${meters} m`);
    this.emitMeasurement(meters);
  }

  setAuto(on, intervalMs = 3000) {
    clearInterval(this.timer);
    this.timer = null;
    if (on) this.timer = setInterval(() => this.triggerMeasure(), intervalMs);
  }

  get auto() {
    return this.timer !== null;
  }
}
