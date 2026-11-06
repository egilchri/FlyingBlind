// A pretend laser meter, so the app can be built and tried without hardware.
//
// - triggerMeasure() produces one reading, like pressing the meter's button.
// - setAuto(true, 'slow') streams a reading every 3 seconds, drifting slowly
//   as if the user were walking toward or away from a wall.
// - setAuto(true, 'scan') streams 20 readings a second from a pretend room.
//   On a phone with a motion sensor, turning the phone left and right aims the
//   pretend laser; otherwise it sweeps back and forth by itself.

import { Driver } from './driver.js';

// The pretend room, as seen from where you stand: the distance to whatever is
// in each direction. Angles are degrees clockwise from where you faced when
// streaming started. Later entries sit in front of earlier ones.
const ROOM = [
  { from: -180, to: 180, meters: 4.0 }, // walls all round
  { from: 60, to: 120, meters: 6.5 }, // alcove to the right
  { from: 150, to: 210, meters: 2.5 }, // close wall behind you
  { from: -95, to: -70, meters: 9.0 }, // open doorway on the left
  { from: -12, to: 8, meters: 1.2 }, // chair straight ahead
  { from: 25, to: 33, meters: 0.6 }, // something very close, front right
];

function wrap(deg) {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

export function roomDistance(angleDeg) {
  const a = wrap(angleDeg);
  let meters = ROOM[0].meters;
  for (const f of ROOM) {
    const from = wrap(f.from);
    const to = wrap(f.to);
    const inside = from <= to ? a >= from && a <= to : a >= from || a <= to;
    if (inside) meters = f.meters;
  }
  // Walls aren't flat-on everywhere: add a little slant and sensor noise.
  return meters * (1 + 0.04 * Math.sin((a * Math.PI) / 45)) + (Math.random() - 0.5) * 0.004;
}

export class SimulatorDriver extends Driver {
  static label = 'Simulator (no device)';
  canTrigger = true;
  canAuto = true;

  distance = 3.0;
  timer = null;
  heading = null; // phone yaw from the motion sensor, if any
  headingStart = null;
  scanStart = 0;

  onOrientation = (e) => {
    if (e.alpha === null) return;
    // alpha grows counter-clockwise; flip so turning right = positive angle.
    const h = -e.alpha;
    if (this.headingStart === null) this.headingStart = h;
    this.heading = h;
  };

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

  scanAngle() {
    if (this.heading !== null) return this.heading - this.headingStart;
    // No motion sensor: sweep ±100° over about 8 seconds.
    const t = (performance.now() - this.scanStart) / 1000;
    return 100 * Math.sin((t * 2 * Math.PI) / 8);
  }

  scanOnce() {
    if (this.state !== 'connected') return;
    const meters = Math.round(roomDistance(this.scanAngle()) * 1000) / 1000;
    this.emitMeasurement(meters);
  }

  setAuto(on, mode = 'slow') {
    clearInterval(this.timer);
    this.timer = null;
    window.removeEventListener('deviceorientation', this.onOrientation);
    if (!on) return;
    if (mode === 'scan') {
      this.heading = null;
      this.headingStart = null;
      this.scanStart = performance.now();
      window.addEventListener('deviceorientation', this.onOrientation);
      this.log('Scanning a pretend room. Turn the phone left and right to aim, if it has a motion sensor.');
      this.timer = setInterval(() => this.scanOnce(), 50);
    } else {
      this.timer = setInterval(() => this.triggerMeasure(), 3000);
    }
  }

  get auto() {
    return this.timer !== null;
  }
}
