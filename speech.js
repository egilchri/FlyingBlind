// Thin wrapper around the Web Speech API (speechSynthesis).
// A new utterance always interrupts whatever is being said, so the user
// hears the latest reading right away.

const synth = window.speechSynthesis;

export const speechSupported = !!synth;

export function listVoices() {
  return new Promise((resolve) => {
    if (!synth) return resolve([]);
    const voices = synth.getVoices();
    if (voices.length) return resolve(voices);
    // Chrome loads voices asynchronously.
    const done = () => resolve(synth.getVoices());
    synth.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}

export function speak(text, { rate = 1, voiceURI = '' } = {}) {
  if (!synth || !text) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  if (voiceURI) {
    const v = synth.getVoices().find((x) => x.voiceURI === voiceURI);
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    }
  }
  // Chrome sometimes drops an utterance queued in the same tick as cancel().
  setTimeout(() => synth.speak(u), 0);
}

export function stopSpeaking() {
  if (synth) synth.cancel();
}
