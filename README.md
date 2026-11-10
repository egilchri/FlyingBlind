# FlyingBlind

A PWA that reads a Bluetooth laser distance meter and speaks each measurement.
Built for Android Chrome (Web Bluetooth + Speech Synthesis). No build step: plain HTML/CSS/JS.

## Try it without a device

```sh
python3 -m http.server 8000
```

Open http://localhost:8000 in Chrome, choose **Simulator**, press **Connect**, then **Measure**
(or tick "Stream readings"). Tap the big reading to hear it again.

## Tone mode

Set **Feedback** to **Tone (pitch follows distance)**. Instead of speaking, the app plays a continuous
tone: closer is higher (you can flip this in Settings). The pitch scale is logarithmic, so every
doubling of distance moves it by the same amount, which gives fine detail up close. Distances past
the chosen **Tone range** all get the lowest pitch. If readings stop arriving, the tone fades out,
so silence always means "no information" rather than an old distance. Tap the big reading to hear
the exact number. **Test tone** sweeps from near to far so you can learn the scale.

To try it without a device: choose Simulator, Connect, and tick **Stream a pretend room scan**. On
a phone, turning the phone left and right aims a pretend laser around a pretend room (a chair ahead,
a doorway on the left, a close wall behind you). Without a motion sensor it sweeps on its own.

The tone can only change as fast as the meter sends readings. See "Real-time scanning hardware" below.

## Run it on the Pixel

Web Bluetooth needs HTTPS or `localhost`.

**During development (USB):**
1. On the Pixel, turn on Developer options and USB debugging. Plug it into the Mac.
2. In desktop Chrome open `chrome://inspect/#devices`, click **Port forwarding**, add `8000 → localhost:8000`.
3. On the Pixel, open Chrome and go to `http://localhost:8000`.

**To install it properly:** push this folder to a GitHub repo, turn on GitHub Pages, open the
`https://…github.io/…` URL on the Pixel, and choose **Add to Home screen** / **Install app**.

## Sources

| Source | Status |
|---|---|
| Simulator | Works now |
| Leica DISTO (BLE) | Written from community protocol notes. Not yet tested on hardware |
| Bosch GLM C-series (BLE) | Written from community reverse engineering. Not yet tested on hardware |
| ESP32 LiDAR (BLE) | Sketch: driver + firmware in `firmware/lidar-ble/`. Not yet tested on hardware |
| BLE explorer | Connects to any device, lists services, logs raw notifications (see the Log panel) |

Adding a meter = one file in `devices/` extending `BleDriver` (`requestOptions()` + `setup()`),
then registering it in `DRIVERS` in `app.js`.

## Testing the Bluetooth path before buying a meter

On a second Android phone, install **nRF Connect** → *Configure GATT server* → add a service
`3ab10100-f831-4395-b29d-570977d5bf94` with a notify characteristic
`3ab10101-f831-4395-b29d-570977d5bf94`, and advertise it. On the Pixel, choose **Leica DISTO**
and Connect. Send a 4-byte value from nRF Connect (e.g. `33 33 13 40` = 2.3 as a little-endian float32)
and the Pixel should say "2.3 meters".

## Real-time scanning hardware

Hand-held laser meters such as the DISTO and GLM are built to take one careful reading per button
press. Over Bluetooth they usually send only finished measurements, so even in their continuous
modes expect around 1 to 3 readings a second at best, which is too slow for a smooth tone while
waving the meter. For true real-time scanning, a small time-of-flight LiDAR sensor (for example
TF-Luna or TFmini-S, 100+ readings a second, about 8 to 12 m range) on an ESP32 board that sends
readings over BLE would work well.

A first version of this is in the repo:

- `firmware/lidar-ble/lidar-ble.ino`: an Arduino sketch for the ESP32. It reads the sensor over
  UART, plays the distance as a tone on a passive buzzer (so no phone is needed), and also sends
  about 50 readings a second over BLE, as the device "FBLidar". The wiring is in the file header.
- `firmware/lidar-ble/tone_logic.h`: how readings become a pitch: log scale, closer = higher,
  400–3000 Hz to suit a piezo buzzer, a short glide, silence for "no target", and a low tick every
  3 seconds if the sensor stops sending. Settings are at the top of the sketch.
- `devices/esp32-lidar.js`: the matching source, listed as **ESP32 LiDAR** in the app.

Parts: an ESP32 dev board, a TF-Luna (or TFmini-S), four jumper wires and a USB power bank.
To flash it: Arduino IDE → Boards Manager → install "esp32" by Espressif → open the sketch → pick
your board → Upload. The Serial Monitor (115200 baud) should show `FBLidar advertising`.

When nothing is in range, or the return is too weak, the device sends "no target" and the tone goes
silent. In speech mode the stream is shown on screen but only spoken when you press **Measure**. The
log shows the actual reading rate every 5 seconds, so you can check the Bluetooth link is keeping up.

The parts list, wiring diagram and build steps are in `docs/lidar-parts.html` (online at
`https://egilchri.github.io/FlyingBlind/docs/lidar-parts.html`).

A 3D picture of the phone-free version, held in a hand, is in `docs/pocket-scanner.html`. Open it
in a browser (or at `https://egilchri.github.io/FlyingBlind/docs/pocket-scanner.html`) and drag to
turn it.

Two alternative designs, also as 3D pictures:

- `docs/matchbox-scanner.html`: everything packed into a 46 × 34 × 38 mm case with a built-in
  battery. Smallest, but needs soldering and a 3D-printed case.
- `docs/wand-scanner.html`: a lipstick power bank as a flashlight-style handle, with the parts on a
  ruler. No soldering; same wiring and firmware as the first version.
  Its parts list and assembly steps are in `docs/wand-parts.html`.
- `docs/flashlight-scanner.html`: held like a flashlight, so it points where the arm points. The
  same no-solder parts in a printed case, with an XIAO ESP32-S3 board, an on/off button under the
  thumb, and the buzzer grille facing up. Needs a small firmware change for the XIAO's pins.
  Its parts list, wiring and assembly steps are in `docs/flashlight-parts.html`.

How the firmware and the app fit together, and what each sound means, is in
`docs/software-design.html`.

Note: the sensor's beam is infrared and invisible, and it is wider than a laser meter's dot (about
2° for the TF-Luna), so it reads the nearest large surface rather than a pinpoint.

## Tests

```sh
node test/format.test.mjs
node test/pitch.test.mjs
c++ -std=c++17 firmware/test/tone_logic_test.cpp -o /tmp/tone_test && /tmp/tone_test
```
