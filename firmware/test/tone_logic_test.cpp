// Tests the buzzer's pitch logic on a computer (no ESP32 needed).
// Run:  c++ -std=c++17 firmware/test/tone_logic_test.cpp -o /tmp/tone_test && /tmp/tone_test
#include <cstdio>
#include <cmath>
#include "../lidar-ble/tone_logic.h"

static int failed = 0;
static void check(const char *name, bool ok) {
  if (!ok) failed++;
  printf("%s %s\n", ok ? "ok  " : "FAIL", name);
}
static bool near(float a, float b, float tol = 0.5f) { return fabsf(a - b) < tol; }

int main() {
  ToneSettings s;
  check("closest is the high pitch", near(distanceToHz(0.2f, s), 3000));
  check("max range is the low pitch", near(distanceToHz(5.0f, s), 400));
  check("closer than minimum clamps", near(distanceToHz(0.05f, s), 3000));
  check("beyond max clamps", near(distanceToHz(40.0f, s), 400));
  ToneSettings rev; rev.closeHigh = false;
  check("closeHigh=false reverses", near(distanceToHz(0.2f, rev), 400));
  float r1 = distanceToHz(0.5f, s) / distanceToHz(1.0f, s);
  float r2 = distanceToHz(2.0f, s) / distanceToHz(4.0f, s);
  check("each doubling of distance is the same interval", fabsf(r1 - r2) < 1e-3f);

  // Glide and silence, simulating 100 readings a second.
  ToneFollower f;
  uint32_t t = 0;
  check("silent before any reading", f.output(t) == 0);
  f.onReading(t += 10, 1200);  // 1.2 m
  float at12 = distanceToHz(1.2f, s);
  check("first reading starts right at its pitch", near(f.output(t), at12));
  f.onReading(t += 10, 600);   // jump to 0.6 m
  float mid = f.output(t);
  check("a jump glides (partway after one reading)", mid > at12 && mid < distanceToHz(0.6f, s));
  for (int i = 0; i < 10; i++) f.onReading(t += 10, 600);
  check("...and settles within ~100 ms", near(f.output(t), distanceToHz(0.6f, s), 2));

  f.onReading(t += 10, 0);     // one dropped reading
  check("a single no-target blip keeps the tone", f.output(t) > 0);
  f.onReading(t += 10, 600);
  for (int i = 0; i < 7; i++) f.onReading(t += 10, 0);
  check("no target for 70 ms goes silent", f.output(t) == 0);
  f.onReading(t += 10, 3000);
  check("tone comes back straight at the new pitch", near(f.output(t), distanceToHz(3.0f, s)));

  t += 250;                    // sensor stops sending
  check("sensor silent for 250 ms: silence", f.output(t) == 0);
  t += 2000;                   // now > 2 s without frames
  bool ticked = false, quiet = false;
  for (uint32_t k = 0; k < 3000; k += 5) {
    float o = f.output(t + k);
    if (o > 0) ticked = true; else quiet = true;
  }
  check("sensor gone for > 2 s: a low tick every 3 s", ticked && quiet);

  ToneFollower boot;
  bool earlyTick = false;
  for (uint32_t k = 0; k < 2000; k += 5) if (boot.output(k) > 0) earlyTick = true;
  check("no fault tick in the first 2 s after power-on", !earlyTick);
  check("fault tick if the sensor never starts", boot.output(2001) > 0);

  if (failed) { printf("\n%d failed\n", failed); return 1; }
  printf("\nall passed\n");
  return 0;
}
