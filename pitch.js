// Maps a distance to a tone frequency.
//
// The mapping is logarithmic in distance and in pitch, so each doubling of
// distance moves the tone by the same musical interval. That gives fine
// resolution up close (where it matters most) and still spans the whole range.
//
// settings:
//   maxMeters:  distances at or beyond this get the "far" pitch
//   closeHigh:  true = closer sounds higher (like a parking sensor)

export const MIN_METERS = 0.2;
export const LOW_HZ = 180;
export const HIGH_HZ = 1500;

export function distanceToHz(meters, { maxMeters = 5, closeHigh = true } = {}) {
  const max = Math.max(maxMeters, MIN_METERS * 2);
  const d = Math.min(Math.max(meters, MIN_METERS), max);
  // t = 0 at MIN_METERS, 1 at max
  const t = Math.log(d / MIN_METERS) / Math.log(max / MIN_METERS);
  const u = closeHigh ? 1 - t : t;
  return LOW_HZ * Math.pow(HIGH_HZ / LOW_HZ, u);
}
