// FlyingBlind LiDAR: an ESP32 reads a Benewake TF-Luna / TFmini-S LiDAR over
// UART, plays the distance as a tone on a buzzer (no phone needed), and also
// streams it to the phone app over Bluetooth Low Energy.
//
// SKETCH: written from the datasheets, not yet run on hardware.
//
// Board:   Either of these. The pins are picked automatically from the board
//          chosen under Tools -> Board:
//            - ESP32-WROOM-32 DevKit (38 pin): first version and wand
//            - Seeed XIAO ESP32-S3 ("XIAO_ESP32S3"): flashlight version
//          Other ESP32 boards work if you add their pin numbers below.
// Library: none beyond the ESP32 Arduino core (Boards Manager: "esp32" by
//          Espressif). Works with core 2.x and 3.x.
//
// Wiring (TF-Luna, pins numbered from the left with the connector facing you):
//                         DevKit             XIAO ESP32-S3
//   TF-Luna pin 1  +5V -> 5V (VIN)           5V
//   TF-Luna pin 2  RXD -> GPIO 17 (TX2)      D6 (TX)
//   TF-Luna pin 3  TXD -> GPIO 16 (RX2)      D7 (RX)
//   TF-Luna pin 4  GND -> GND                GND (shared with the buzzer
//                                             through a Y splitter: the XIAO
//                                             has only one GND pin)
//   TF-Luna pin 5  CFG -> leave unconnected (UART mode)
// The TFmini-S is the same, but its cable colors are: red 5V, black GND,
// white RXD, green TXD. Both sensors use 3.3 V logic, so no level shifter is needed.
//
// Wiring (passive buzzer module, 3 pins):
//                     DevKit      XIAO ESP32-S3
//   S (signal)  ->    GPIO 25     D0
//   +           ->    3V3         3V3
//   -           ->    GND         GND (through the Y splitter)
//
// What you hear:
//   - At power-on: three rising beeps.
//   - Pointing at something: a steady tone, higher when closer.
//   - Nothing in range (or a surface the sensor can't see well): silence.
//   - A short low tick every 3 seconds: the sensor isn't sending. Check its wires.
//
// BLE protocol (matches devices/esp32-lidar.js):
//   Advertised name  "FBLidar"
//   Service          2bb8a36a-863a-4b3a-b494-828a89dafdb8
//   Reading (notify) 9a61290c-d108-406a-9ce2-10a133f5d5b8
//     4 bytes, little-endian:
//       uint16  distance in millimeters, 0 = no target (out of range or weak return)
//       uint16  signal strength as reported by the sensor

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include "tone_logic.h"

#ifndef ESP_ARDUINO_VERSION_MAJOR
#define ESP_ARDUINO_VERSION_MAJOR 2
#endif

#define SERVICE_UUID "2bb8a36a-863a-4b3a-b494-828a89dafdb8"
#define READING_UUID "9a61290c-d108-406a-9ce2-10a133f5d5b8"

// ---- pins, chosen by the board selected under Tools -> Board ----
#if defined(ARDUINO_XIAO_ESP32S3)
// Seeed XIAO ESP32-S3: use the names printed on the board.
const int LIDAR_RX = D7;    // GPIO 44, receives from the sensor's TXD
const int LIDAR_TX = D6;    // GPIO 43, sends to the sensor's RXD
const int BUZZER_PIN = D0;  // GPIO 1
// D6/D7 are also the chip's default debug serial port. With "USB CDC On Boot"
// enabled (the XIAO's default), debug messages go over USB instead, leaving
// D6/D7 free for the sensor. Without it, debug text would be sent to the sensor.
#if !ARDUINO_USB_CDC_ON_BOOT
#error "Set Tools -> USB CDC On Boot -> Enabled for the XIAO ESP32-S3"
#endif
#elif defined(CONFIG_IDF_TARGET_ESP32)
// ESP32-WROOM-32 DevKit.
const int LIDAR_RX = 16;    // RX2, receives from the sensor's TXD
const int LIDAR_TX = 17;    // TX2, sends to the sensor's RXD
const int BUZZER_PIN = 25;
#else
#error "No pin numbers for this board yet. Add them in the pins section of lidar-ble.ino."
#endif
const uint32_t LIDAR_BAUD = 115200;

// The sensor measures at 100 Hz. Sending every 20 ms (50 Hz) is plenty for a
// smooth tone and leaves headroom on the Bluetooth link.
const uint32_t SEND_EVERY_MS = 20;

// Below this signal strength the TF-Luna's distance is unreliable (datasheet).
const uint16_t MIN_STRENGTH = 100;

// ---- buzzer settings: change these to taste ----
const bool BUZZER_ON = true;      // false = phone-only, like before
const int VOLUME_PERCENT = 100;   // 1-100. A passive buzzer is loudest at 100.
ToneFollower pitch;               // range and pitch settings: see tone_logic.h
// To change them, add lines like these at the start of setup():
// For example, to cover a bigger room:  pitch.settings.maxMeters = 8;
// To make closer sound lower instead:   pitch.settings.closeHigh = false;

BLECharacteristic *reading = nullptr;
bool connected = false;

class ServerCallbacks : public BLEServerCallbacks {
  // Ask the phone for a short connection interval (7.5-15 ms) so readings
  // arrive with little delay. Units are 1.25 ms; the phone may refuse.
  // The ESP32 and the ESP32-S3 use different Bluetooth stacks in core 3.x
  // (Bluedroid and NimBLE), and each passes the connection differently.
#if defined(CONFIG_NIMBLE_ENABLED)
  void onConnect(BLEServer *server, ble_gap_conn_desc *desc) override {
    connected = true;
    server->updateConnParams(desc->conn_handle, 6, 12, 0, 400);
  }
#else
  void onConnect(BLEServer *server, esp_ble_gatts_cb_param_t *param) override {
    connected = true;
    server->updateConnParams(param->connect.remote_bda, 6, 12, 0, 400);
  }
#endif
  void onDisconnect(BLEServer *server) override {
    connected = false;
    BLEDevice::startAdvertising();  // be ready for the phone to reconnect
  }
};

// ---- buzzer output (LEDC PWM; the API changed between core 2.x and 3.x) ----
const int PWM_BITS = 8;
const int PWM_CHANNEL = 0;  // only used by core 2.x
float playingHz = 0;

void buzzerBegin() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(BUZZER_PIN, 1000, PWM_BITS);
#else
  ledcSetup(PWM_CHANNEL, 1000, PWM_BITS);
  ledcAttachPin(BUZZER_PIN, PWM_CHANNEL);
#endif
}

void buzzerWrite(uint32_t duty) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(BUZZER_PIN, duty);
#else
  ledcWrite(PWM_CHANNEL, duty);
#endif
}

void buzzerFrequency(float hz) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcChangeFrequency(BUZZER_PIN, (uint32_t)hz, PWM_BITS);
#else
  ledcChangeFrequency(PWM_CHANNEL, (uint32_t)hz, PWM_BITS);
#endif
}

// Play hz, or silence for 0. Skips tiny changes so the buzzer doesn't crackle.
void buzzerPlay(float hz) {
  if (hz <= 0) {
    if (playingHz > 0) buzzerWrite(0);
    playingHz = 0;
    return;
  }
  bool wasSilent = playingHz == 0;
  if (wasSilent || fabsf(hz - playingHz) / playingHz > 0.004f) {
    buzzerFrequency(hz);
    playingHz = hz;
  }
  // Full volume is a 50% duty square wave; less duty is quieter.
  if (wasSilent) buzzerWrite((1u << (PWM_BITS - 1)) * VOLUME_PERCENT / 100);
}

void startupChirp() {
  for (float hz : {900.0f, 1400.0f, 2100.0f}) {
    buzzerPlay(hz);
    delay(90);
    buzzerPlay(0);
    delay(40);
  }
}

// ---- TF-Luna / TFmini-S UART frame parser ----
// Frame: 0x59 0x59 distL distH strengthL strengthH tempL tempH checksum
// distance in cm; checksum = low byte of the sum of the first 8 bytes.

uint8_t frame[9];
int frameLen = 0;

// Returns true when a complete, valid frame has been read.
bool readFrame(uint16_t &cm, uint16_t &strength) {
  while (Serial2.available()) {
    uint8_t b = Serial2.read();
    if (frameLen < 2) {
      // Hunt for the two 0x59 header bytes.
      if (b == 0x59) frame[frameLen++] = b;
      else frameLen = 0;
      continue;
    }
    frame[frameLen++] = b;
    if (frameLen == 9) {
      frameLen = 0;
      uint8_t sum = 0;
      for (int i = 0; i < 8; i++) sum += frame[i];
      if (sum != frame[8]) continue;  // corrupted, wait for the next one
      cm = frame[2] | (frame[3] << 8);
      strength = frame[4] | (frame[5] << 8);
      return true;
    }
  }
  return false;
}

void setup() {
  Serial.begin(115200);
  Serial2.begin(LIDAR_BAUD, SERIAL_8N1, LIDAR_RX, LIDAR_TX);
  if (BUZZER_ON) {
    buzzerBegin();
    startupChirp();
  }

  BLEDevice::init("FBLidar");  // short name so it fits beside the 128-bit UUID
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  BLEService *service = server->createService(SERVICE_UUID);
  reading = service->createCharacteristic(READING_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  reading->addDescriptor(new BLE2902());
  service->start();

  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("FBLidar advertising");
}

void loop() {
  static uint32_t lastSend = 0, lastFrame = 0;
  static uint16_t latestMm = 0, latestStrength = 0;

  uint16_t cm, strength;
  while (readFrame(cm, strength)) {
    bool valid = strength >= MIN_STRENGTH && strength != 65535 && cm > 0;
    latestMm = valid ? cm * 10 : 0;
    latestStrength = strength;
    lastFrame = millis();
    pitch.onReading(lastFrame, latestMm);
  }

  uint32_t now = millis();
  if (BUZZER_ON) buzzerPlay(pitch.output(now));
  // Sensor unplugged or stopped: report "no target" rather than an old distance.
  if (now - lastFrame > 200) latestMm = latestStrength = 0;

  if (connected && now - lastSend >= SEND_EVERY_MS) {
    lastSend = now;
    uint8_t out[4] = {
      (uint8_t)(latestMm & 0xff), (uint8_t)(latestMm >> 8),
      (uint8_t)(latestStrength & 0xff), (uint8_t)(latestStrength >> 8),
    };
    reading->setValue(out, sizeof out);
    reading->notify();
  }
}
