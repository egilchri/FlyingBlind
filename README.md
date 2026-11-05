# FlyingBlind

A PWA that reads a Bluetooth laser distance meter and speaks each measurement.
Built for Android Chrome (Web Bluetooth + Speech Synthesis). No build step: plain HTML/CSS/JS.

## Try it without a device

```sh
python3 -m http.server 8000
```

Open http://localhost:8000 in Chrome, choose **Simulator**, press **Connect**, then **Measure**
(or tick "Stream readings"). Tap the big reading to hear it again.

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

## Tests

```sh
node test/format.test.mjs
```
