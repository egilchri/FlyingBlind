// Turns a stream of LiDAR readings into the pitch the buzzer should play.
// Plain C++ with no Arduino calls, so it can be tested on a computer
// (see firmware/test/tone_logic_test.cpp).
//
// Behaviour, matching the phone app's tone mode:
//   - Pitch follows distance on a log scale: every doubling of distance moves
//     it by the same interval, which gives fine detail up close.
//   - The pitch glides between readings, so waving gives a smooth sweep, but
//     a jump from a near object to a far wall is still heard as a clear step.
//   - "No target" (nothing in range, or too weak a return) = silence. A single
//     dropped reading doesn't cut the tone; it has to last a few readings.
//   - If the sensor stops sending at all, the tone stops, and a low tick every
//     few seconds says "sensor problem" so it isn't mistaken for "nothing there".

#pragma once
#include <math.h>
#include <stdint.h>

struct ToneSettings {
  float minMeters = 0.2f;   // closest the TF-Luna can measure
  float maxMeters = 5.0f;   // at and beyond this: the lowest pitch
  float lowHz = 400.0f;     // a passive piezo buzzer is very quiet below ~400 Hz
  float highHz = 3000.0f;   // ...and loudest around 2-4 kHz
  bool closeHigh = true;    // closer = higher, like a parking sensor
};

inline float distanceToHz(float meters, const ToneSettings &s) {
  float mx = s.maxMeters > s.minMeters * 2 ? s.maxMeters : s.minMeters * 2;
  float d = meters < s.minMeters ? s.minMeters : (meters > mx ? mx : meters);
  float t = logf(d / s.minMeters) / logf(mx / s.minMeters);  // 0 near, 1 far
  float u = s.closeHigh ? 1.0f - t : t;
  return s.lowHz * powf(s.highHz / s.lowHz, u);
}

class ToneFollower {
 public:
  explicit ToneFollower(ToneSettings s = ToneSettings()) : settings(s) {}

  ToneSettings settings;

  // How much of the gap to the new pitch to close on each reading. At 100
  // readings a second, 0.5 settles in about 30 ms, like the app's glide.
  float glide = 0.5f;
  uint32_t noTargetHoldMs = 60;    // ignore "no target" blips shorter than this
  uint32_t staleMs = 200;          // no frames for this long = silence
  uint32_t faultAfterMs = 2000;    // no frames for this long = sensor problem
  uint32_t faultEveryMs = 3000;    // ...then tick this often
  uint32_t faultTickMs = 60;
  float faultHz = 300.0f;

  // Call for every frame from the sensor. mm = 0 means no target.
  void onReading(uint32_t now, uint16_t mm) {
    lastFrameMs = now;
    everHadFrame = true;
    if (mm == 0) {
      if (noTargetSinceMs == 0) noTargetSinceMs = now ? now : 1;
      return;
    }
    noTargetSinceMs = 0;
    float target = logf(distanceToHz(mm / 1000.0f, settings));
    if (logHz == 0) logHz = target;  // start straight at the right pitch
    else logHz += (target - logHz) * glide;
  }

  // The frequency to play right now, or 0 for silence.
  float output(uint32_t now) {
    // Before the first frame, count from power-on.
    uint32_t sinceFrame = everHadFrame ? now - lastFrameMs : now;
    if (sinceFrame > faultAfterMs) {
      logHz = 0;
      uint32_t since = sinceFrame - faultAfterMs;
      return (since % faultEveryMs) < faultTickMs ? faultHz : 0;
    }
    if (!everHadFrame) return 0;
    if (sinceFrame > staleMs) logHz = 0;
    if (noTargetSinceMs && now - noTargetSinceMs >= noTargetHoldMs) logHz = 0;
    return logHz == 0 ? 0 : expf(logHz);
  }

 private:
  float logHz = 0;  // log of the current frequency; 0 = silent
  uint32_t lastFrameMs = 0;
  uint32_t noTargetSinceMs = 0;
  bool everHadFrame = false;
};
