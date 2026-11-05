// Run with: node test/format.test.mjs
import { formatDistance } from '../format.js';

const cases = [
  // [meters, settings, expected speech, expected display]
  [2.3495, { units: 'metric', precision: 2 }, '2.35 meters', '2.35 m'],
  [2.3, { units: 'metric', precision: 2 }, '2.3 meters', '2.30 m'],
  [1.0, { units: 'metric', precision: 2 }, '1 meter', '1.00 m'],
  [0.4567, { units: 'metric', precision: 3 }, '0.457 meters', '0.457 m'],
  [12.04, { units: 'metric', precision: 0 }, '12 meters', '12 m'],
  [2.35, { units: 'feet', fraction: 2 }, '7 feet 8 and a half inches', '7′ 8½″'],
  [2.35, { units: 'feet', fraction: 1 }, '7 feet 9 inches', '7′ 9″'],
  [2.35, { units: 'feet', fraction: 4 }, '7 feet 8 and a half inches', '7′ 8½″'],
  [0.3048, { units: 'feet', fraction: 2 }, '1 foot', '1′ 0″'],
  [0.3175, { units: 'feet', fraction: 2 }, '1 foot a half inch', '1′ ½″'],
  [0.0254, { units: 'feet', fraction: 2 }, '1 inch', '0′ 1″'],
  [0.0127, { units: 'feet', fraction: 2 }, 'a half inch', '0′ ½″'],
  [0.3683, { units: 'feet', fraction: 4 }, '1 foot 2 and a half inches', '1′ 2½″'],
  [0.3747, { units: 'feet', fraction: 4 }, '1 foot 2 and three quarters inches', '1′ 2¾″'],
  [0.0857, { units: 'feet', fraction: 8 }, '3 and 3 eighths inches', '0′ 3⅜″'],
  [0.3045, { units: 'feet', fraction: 2 }, '1 foot', '1′ 0″'], // 11.99" rounds up to a whole foot
  [2.35, { units: 'inches', fraction: 2 }, '92 and a half inches', '92½″'],
  [NaN, {}, 'No reading', '—'],
];

let failed = 0;
for (const [m, s, speech, display] of cases) {
  const got = formatDistance(m, s);
  const ok = got.speech === speech && got.display === display;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${m} ${JSON.stringify(s)} -> "${got.speech}" / "${got.display}"` +
    (ok ? '' : `   expected "${speech}" / "${display}"`));
}
console.log(failed ? `\n${failed} failed` : `\nall ${cases.length} passed`);
process.exit(failed ? 1 : 0);
