// Run with: node test/pitch.test.mjs
import { distanceToHz, LOW_HZ, HIGH_HZ, MIN_METERS } from '../pitch.js';
import { roomDistance } from '../devices/simulator.js';

let failed = 0;
function check(name, ok) {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
}
const near = (a, b) => Math.abs(a - b) < 1e-6;

check('closest distance is the high pitch', near(distanceToHz(MIN_METERS), HIGH_HZ));
check('max range is the low pitch', near(distanceToHz(5, { maxMeters: 5 }), LOW_HZ));
check('closer than minimum clamps', near(distanceToHz(0.01), HIGH_HZ));
check('beyond max clamps', near(distanceToHz(50, { maxMeters: 5 }), LOW_HZ));
check('closeHigh=false reverses', near(distanceToHz(MIN_METERS, { closeHigh: false }), LOW_HZ));

// Monotonic: every step closer is strictly higher.
let prev = Infinity, mono = true;
for (let m = 0.2; m <= 5; m += 0.05) {
  const hz = distanceToHz(m, { maxMeters: 5 });
  if (!(hz < prev)) mono = false;
  prev = hz;
}
check('pitch falls steadily with distance', mono);

// Log mapping: each doubling of distance = same pitch ratio.
const r1 = distanceToHz(0.5) / distanceToHz(1);
const r2 = distanceToHz(2) / distanceToHz(4);
check('each doubling of distance is the same interval', Math.abs(r1 - r2) < 1e-9);

// Pretend room
check('room: chair straight ahead', Math.abs(roomDistance(0) - 1.2) < 0.1);
check('room: doorway on the left', Math.abs(roomDistance(-80) - 9.0) < 0.5);
check('room: wall behind (wraps past 180)', Math.abs(roomDistance(-170) - 2.5) < 0.2);
check('room: plain wall', Math.abs(roomDistance(-40) - 4.0) < 0.2);

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall passed');
