import { formatDistance } from './format.js';
import { speak, listVoices, speechSupported } from './speech.js';
import { TonePlayer } from './tone.js';
import { bluetoothSupported } from './devices/driver.js';
import { SimulatorDriver } from './devices/simulator.js';
import { LeicaDistoDriver } from './devices/leica-disto.js';
import { BoschGlmDriver } from './devices/bosch-glm.js';
import { GenericBleDriver } from './devices/generic-ble.js';
import { Esp32LidarDriver } from './devices/esp32-lidar.js';

const DRIVERS = {
  simulator: SimulatorDriver,
  disto: LeicaDistoDriver,
  glm: BoschGlmDriver,
  lidar: Esp32LidarDriver,
  explorer: GenericBleDriver,
};

const $ = (id) => document.getElementById(id);
const ui = {
  status: $('status'),
  source: $('source'),
  explorerOptions: $('explorer-options'),
  extraUuids: $('extra-uuids'),
  connect: $('connect'),
  reading: $('reading'),
  readingValue: $('reading-value'),
  measure: $('measure'),
  autoWrap: $('auto-wrap'),
  auto: $('auto'),
  autoLabel: $('auto-label'),
  feedback: $('feedback'),
  toneRange: $('tone-range'),
  toneDirection: $('tone-direction'),
  toneVolume: $('tone-volume'),
  toneVolumeOut: $('tone-volume-out'),
  testTone: $('test-tone'),
  units: $('units'),
  precision: $('precision'),
  fraction: $('fraction'),
  rate: $('rate'),
  rateOut: $('rate-out'),
  voice: $('voice'),
  speakMode: $('speak-mode'),
  output: $('output'),
  testVoice: $('test-voice'),
  log: $('log'),
  clearLog: $('clear-log'),
  announce: $('announce'),
};

// ---------- settings (remembered on this phone) ----------

const SETTINGS_KEY = 'flyingblind.settings';
const DEFAULTS = {
  source: 'simulator',
  units: 'metric',
  precision: 2,
  fraction: 2,
  rate: 1.1,
  voiceURI: '',
  speakMode: 'every',
  output: 'tts',
  extraUuids: '',
  feedback: 'speech',
  toneRange: 5,
  toneDirection: 'high',
  toneVolume: 0.3,
};

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* private mode etc. Settings just won't persist. */
  }
}

const settings = loadSettings();

// ---------- output ----------

const tone = new TonePlayer();

function applyToneSettings() {
  tone.maxMeters = Number(settings.toneRange);
  tone.closeHigh = settings.toneDirection === 'high';
  tone.setVolume(Number(settings.toneVolume));
  ui.toneVolumeOut.textContent = `${Math.round(settings.toneVolume * 100)}%`;
}

const toneMode = () => settings.feedback === 'tone';

let lastMeters = null;
let lastSpoken = '';

function say(text) {
  if (settings.output === 'aria' || !speechSupported) {
    // Clear first so the screen reader announces repeats of the same text.
    ui.announce.textContent = '';
    setTimeout(() => (ui.announce.textContent = text), 50);
  } else {
    speak(text, { rate: settings.rate, voiceURI: settings.voiceURI });
  }
}

function formatSettings() {
  return { units: settings.units, precision: Number(settings.precision), fraction: Number(settings.fraction) };
}

function showReading(meters) {
  const { display, speech } = formatDistance(meters, formatSettings());
  ui.readingValue.textContent = display;
  // In tone mode readings arrive many times a second. Leave the label alone so
  // a screen reader focused on this button doesn't try to read every one.
  ui.reading.setAttribute(
    'aria-label',
    toneMode() ? 'Distance. Tap to hear it.' : `Last reading ${speech}. Tap to repeat.`
  );
  return speech;
}

function onMeasurement(meters, streamed) {
  if (!Number.isFinite(meters)) {
    // The device sees nothing (out of range or too weak a return).
    ui.readingValue.textContent = '—';
    if (toneMode()) tone.silence();
    else if (!streamed) say('No target');
    return;
  }
  lastMeters = meters;
  const speech = showReading(meters);
  if (toneMode()) {
    tone.update(meters);
    return;
  }
  // A fast stream would talk over itself; speak it only when Measure is pressed.
  if (streamed) return;
  if (settings.speakMode === 'change' && speech === lastSpoken) return;
  lastSpoken = speech;
  say(speech);
}

function log(message) {
  const time = new Date().toLocaleTimeString();
  ui.log.textContent = `${time}  ${message}\n` + ui.log.textContent.slice(0, 20000);
}

// ---------- screen wake lock ----------

let wakeLock = null;
let wantWakeLock = false;

async function setWakeLock(on) {
  wantWakeLock = on;
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) {
    log(`Wake lock unavailable: ${e.message}`);
  }
}

// Android releases the wake lock when the app goes to the background.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wantWakeLock) setWakeLock(true);
});

// ---------- driver lifecycle ----------

let driver = null;

function setStatus(state, message) {
  ui.status.dataset.state = state;
  ui.status.textContent = message || state;
}

function refreshControls() {
  const connected = driver?.state === 'connected';
  const busy = driver?.state === 'connecting';
  ui.connect.textContent = connected || busy ? 'Disconnect' : 'Connect';
  ui.connect.classList.toggle('primary', !(connected || busy));
  ui.measure.disabled = !(connected && driver.canTrigger);
  ui.autoWrap.hidden = !(driver instanceof SimulatorDriver);
  ui.auto.disabled = !connected;
  ui.autoLabel.textContent = toneMode()
    ? 'Stream a pretend room scan (20 readings a second)'
    : 'Stream readings every 3 seconds';
  ui.source.disabled = connected || busy;
  ui.explorerOptions.hidden = settings.source !== 'explorer';
}

function makeDriver() {
  const d = new DRIVERS[settings.source]();
  d.addEventListener('measurement', (e) => onMeasurement(e.detail.meters, e.detail.streamed));
  d.addEventListener('log', (e) => log(e.detail.message));
  d.addEventListener('status', (e) => {
    const { state, message } = e.detail;
    setStatus(state, message);
    log(message);
    if (state === 'connected' || state === 'disconnected') say(message);
    setWakeLock(state === 'connected' || state === 'connecting');
    if (state === 'disconnected') ui.auto.checked = false;
    if (state !== 'connected') tone.silence();
    refreshControls();
  });
  return d;
}

async function connectOrDisconnect() {
  tone.unlock(); // audio may only start from a tap
  if (driver && driver.state !== 'disconnected' && driver.state !== 'error') {
    await driver.disconnect();
    return;
  }
  driver = makeDriver();
  if (driver instanceof GenericBleDriver) {
    driver.extraServices = settings.extraUuids
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  refreshControls();
  try {
    await driver.connect();
  } catch (e) {
    // NotFoundError = user closed the device chooser without picking one.
    const cancelled = e.name === 'NotFoundError';
    const message = cancelled ? 'No device chosen' : `Could not connect: ${e.message}`;
    driver.setStatus(cancelled ? 'disconnected' : 'error', message);
  }
}

// ---------- wire up the page ----------

function populateSources() {
  for (const [key, cls] of Object.entries(DRIVERS)) {
    const opt = new Option(cls.label, key);
    if (key !== 'simulator' && !bluetoothSupported) {
      opt.disabled = true;
      opt.textContent += ' (needs Web Bluetooth)';
    }
    ui.source.add(opt);
  }
  if (!bluetoothSupported) settings.source = 'simulator';
  ui.source.value = settings.source;
}

async function populateVoices() {
  const voices = await listVoices();
  const lang = navigator.language.slice(0, 2);
  // Voices in the phone's language first.
  voices.sort((a, b) => (b.lang.startsWith(lang) - a.lang.startsWith(lang)) || a.name.localeCompare(b.name));
  for (const v of voices) ui.voice.add(new Option(`${v.name} (${v.lang})`, v.voiceURI));
  ui.voice.value = settings.voiceURI;
}

function showUnitOptions() {
  const metric = settings.units === 'metric';
  for (const el of document.querySelectorAll('[data-for="metric"]')) el.hidden = !metric;
  for (const el of document.querySelectorAll('[data-for="imperial"]')) el.hidden = metric;
}

function bindSetting(el, key, { number = false, after } = {}) {
  el.value = settings[key];
  el.addEventListener(el.type === 'range' || el.type === 'text' ? 'input' : 'change', () => {
    settings[key] = number ? Number(el.value) : el.value;
    saveSettings();
    after?.();
  });
}

function init() {
  populateSources();
  populateVoices();

  bindSetting(ui.source, 'source', { after: refreshControls });
  bindSetting(ui.extraUuids, 'extraUuids');
  bindSetting(ui.units, 'units', { after: onFormatChange });
  bindSetting(ui.precision, 'precision', { number: true, after: onFormatChange });
  bindSetting(ui.fraction, 'fraction', { number: true, after: onFormatChange });
  bindSetting(ui.rate, 'rate', { number: true, after: () => (ui.rateOut.textContent = `${settings.rate}×`) });
  bindSetting(ui.voice, 'voiceURI');
  bindSetting(ui.speakMode, 'speakMode');
  bindSetting(ui.output, 'output');
  bindSetting(ui.feedback, 'feedback', { after: onFeedbackChange });
  bindSetting(ui.toneRange, 'toneRange', { number: true, after: applyToneSettings });
  bindSetting(ui.toneDirection, 'toneDirection', { after: applyToneSettings });
  bindSetting(ui.toneVolume, 'toneVolume', { number: true, after: applyToneSettings });
  applyToneSettings();
  ui.rateOut.textContent = `${settings.rate}×`;
  showUnitOptions();

  ui.connect.addEventListener('click', connectOrDisconnect);
  ui.measure.addEventListener('click', async () => {
    tone.unlock();
    try {
      await driver?.triggerMeasure();
    } catch (e) {
      log(`Measure failed: ${e.message}`);
      say('Measure failed');
    }
  });
  ui.auto.addEventListener('change', () => {
    tone.unlock();
    driver?.setAuto?.(ui.auto.checked, toneMode() ? 'scan' : 'slow');
  });
  ui.testTone.addEventListener('click', testTone);
  ui.reading.addEventListener('click', () => {
    if (lastMeters === null) say('No reading yet');
    else say(formatDistance(lastMeters, formatSettings()).speech);
  });
  ui.testVoice.addEventListener('click', () => say(formatDistance(2.35, formatSettings()).speech));
  ui.clearLog.addEventListener('click', () => (ui.log.textContent = ''));

  refreshControls();
  if (!bluetoothSupported) log('Web Bluetooth not available here. Only the simulator will work.');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((e) => log(`Offline support unavailable: ${e.message}`));
  }
}

function onFeedbackChange() {
  tone.unlock();
  if (!toneMode()) tone.silence();
  lastSpoken = '';
  // Switch the simulator's stream to match (fast scan for tone, slow for speech).
  if (ui.auto.checked) driver?.setAuto?.(true, toneMode() ? 'scan' : 'slow');
  refreshControls();
  if (lastMeters !== null) showReading(lastMeters);
}

// Glide from near to far over two seconds so the user learns the scale.
function testTone() {
  tone.unlock();
  const max = Number(settings.toneRange);
  const steps = 40;
  let i = 0;
  const id = setInterval(() => {
    const meters = 0.2 * Math.pow(max / 0.2, i / steps);
    tone.update(meters);
    if (++i > steps) {
      clearInterval(id);
      setTimeout(() => tone.silence(), 300);
    }
  }, 50);
}

function onFormatChange() {
  showUnitOptions();
  lastSpoken = '';
  if (lastMeters !== null) showReading(lastMeters);
}

init();
