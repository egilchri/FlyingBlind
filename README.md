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
readings over BLE would work well. It would need one more driver file in `devices/`.

## Tests

```sh
node test/format.test.mjs
node test/pitch.test.mjs
```
