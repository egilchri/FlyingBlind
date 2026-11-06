// A continuous tone whose pitch follows the latest distance reading.
//
// - The pitch glides to each new reading (a few tens of ms), so a fast stream
//   of readings sounds like one smoothly changing tone, while a jump from a
//   near object to a far wall still sounds like a clear step.
// - If readings stop arriving (meter lost the target, link dropped), the tone
//   fades out, so silence means "no information", never a stale distance.
// - Browsers only allow audio after a tap, so call unlock() from a click handler.

import { distanceToHz } from './pitch.js';

const GLIDE_S = 0.03;
const FADE_S = 0.05;

export class TonePlayer {
  ctx = null;
  osc = null;
  gain = null;
  staleTimer = null;
  playing = false;

  // settings, updated by the app
  maxMeters = 5;
  closeHigh = true;
  volume = 0.3;
  staleMs = 1500;

  get supported() {
    return !!(window.AudioContext || window.webkitAudioContext);
  }

  unlock() {
    if (!this.supported) return;
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.ctx.destination);
      this.osc = this.ctx.createOscillator();
      // Triangle carries better on a phone speaker than a sine, without a square's harshness.
      this.osc.type = 'triangle';
      this.osc.connect(this.gain);
      this.osc.start();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  // Call for every reading.
  update(meters) {
    if (!this.ctx || !Number.isFinite(meters)) return;
    const now = this.ctx.currentTime;
    const hz = distanceToHz(meters, { maxMeters: this.maxMeters, closeHigh: this.closeHigh });
    if (this.playing) {
      this.osc.frequency.setTargetAtTime(hz, now, GLIDE_S);
    } else {
      // Start straight at the right pitch rather than sliding up from the last one.
      this.osc.frequency.cancelScheduledValues(now);
      this.osc.frequency.setValueAtTime(hz, now);
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setTargetAtTime(this.volume, now, FADE_S / 3);
      this.playing = true;
    }
    clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => this.silence(), this.staleMs);
  }

  setVolume(v) {
    this.volume = v;
    if (this.playing && this.ctx) this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, FADE_S / 3);
  }

  silence() {
    clearTimeout(this.staleTimer);
    if (!this.ctx || !this.playing) return;
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setTargetAtTime(0, now, FADE_S / 3);
    this.playing = false;
  }
}
