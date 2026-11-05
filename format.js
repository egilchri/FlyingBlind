// Turns a distance in meters into spoken text and short display text.
//
// settings:
//   units:     'metric' | 'feet' (feet + inches) | 'inches'
//   precision: decimal places for metric (0-3)
//   fraction:  inch resolution for imperial, as a denominator (1, 2, 4, 8, 16)

const M_PER_INCH = 0.0254;

export const DEFAULT_FORMAT = { units: 'metric', precision: 2, fraction: 2 };

function plural(n, one, many) {
  return n === 1 ? one : many;
}

function trimNumber(x, decimals) {
  // 2.30 -> "2.3", 2.00 -> "2"
  return String(Number(x.toFixed(decimals)));
}

// Words for a fraction of an inch, num/den already reduced.
function fractionWords(num, den) {
  if (den === 2) return 'a half';
  if (den === 4) return num === 1 ? 'a quarter' : 'three quarters';
  const names = { 8: 'eighth', 16: 'sixteenth' };
  const name = names[den] || `${den}th`;
  return num === 1 ? `one ${name}` : `${num} ${name}s`;
}

function fractionGlyph(num, den) {
  const glyphs = { '1/2': '½', '1/4': '¼', '3/4': '¾', '1/8': '⅛', '3/8': '⅜', '5/8': '⅝', '7/8': '⅞' };
  return glyphs[`${num}/${den}`] || `${num}/${den}`;
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

// Round to the nearest 1/den inch. Returns { whole, num, den } with the fraction reduced.
function splitInches(totalInches, den) {
  const ticks = Math.round(totalInches * den);
  const whole = Math.floor(ticks / den);
  let num = ticks % den;
  let d = den;
  if (num) {
    const g = gcd(num, d);
    num /= g;
    d /= g;
  }
  return { whole, num, den: d };
}

// "8 and a half inches", "1 inch", "a half inch", "0 inches"
function inchesWords(whole, num, den) {
  if (!num) return `${whole} ${plural(whole, 'inch', 'inches')}`;
  const frac = fractionWords(num, den);
  if (whole === 0) return `${frac} inch`;
  return `${whole} and ${frac} inches`;
}

function inchesGlyph(whole, num, den) {
  if (!num) return `${whole}″`;
  return `${whole ? whole : ''}${fractionGlyph(num, den)}″`;
}

export function formatDistance(meters, settings = {}) {
  const s = { ...DEFAULT_FORMAT, ...settings };

  if (!Number.isFinite(meters)) {
    return { speech: 'No reading', display: '—' };
  }

  if (s.units === 'metric') {
    const n = trimNumber(meters, s.precision);
    return {
      speech: `${n} ${n === '1' ? 'meter' : 'meters'}`,
      display: `${meters.toFixed(s.precision)} m`,
    };
  }

  const den = Number(s.fraction) || 1;
  const totalInches = meters / M_PER_INCH;

  if (s.units === 'inches') {
    const { whole, num, den: d } = splitInches(totalInches, den);
    return { speech: inchesWords(whole, num, d), display: inchesGlyph(whole, num, d) };
  }

  // feet + inches
  const { whole, num, den: d } = splitInches(totalInches, den);
  const feet = Math.floor(whole / 12);
  const inches = whole % 12;
  const feetWords = `${feet} ${plural(feet, 'foot', 'feet')}`;

  let speech;
  if (feet === 0) speech = inchesWords(inches, num, d);
  else if (inches === 0 && !num) speech = feetWords;
  else if (inches === 0) speech = `${feetWords} ${fractionWords(num, d)} inch`;
  else speech = `${feetWords} ${inchesWords(inches, num, d)}`;

  return {
    speech,
    display: `${feet}′ ${inchesGlyph(inches, num, d)}`,
  };
}
