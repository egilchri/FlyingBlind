// FlyingBlind LiDAR: an ESP32 reads a Benewake TF-Luna / TFmini-S LiDAR over
// UART and streams the distance to the phone over Bluetooth Low Energy.
//
// SKETCH: written from the sensor datasheets, not yet run on hardware.
//
// Board:   any ESP32 dev board (ESP32-WROOM, ESP32-C3, ESP32-S3 also work;
//          change the pins below to match).
// Library: none beyond the ESP32 Arduino core (Boards Manager: "esp32" by Espressif).
//
// Wiring (TF-Luna, pins numbered from the left with the connector facing you):
//   TF-Luna pin 1  +5V   -> ESP32 5V (VIN)
//   TF-Luna pin 2  RXD   -> ESP32 GPIO 17 (TX2)
//   TF-Luna pin 3  TXD   -> ESP32 GPIO 16 (RX2)
//   TF-Luna pin 4  GND   -> ESP32 GND
//   TF-Luna pin 5  CFG   -> leave unconnected (UART mode)
// The TFmini-S is the same, but its cable colors are: red 5V, black GND,
// white RXD, green TXD. Both sensors use 3.3 V logic, so no level shifter is needed.
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

#define SERVICE_UUID "2bb8a36a-863a-4b3a-b494-828a89dafdb8"
#define READING_UUID "9a61290c-d108-406a-9ce2-10a133f5d5b8"

const int LIDAR_RX = 16;  // ESP32 pin receiving from the sensor's TXD
const int LIDAR_TX = 17;  // ESP32 pin sending to the sensor's RXD
const uint32_t LIDAR_BAUD = 115200;

// The sensor measures at 100 Hz. Sending every 20 ms (50 Hz) is plenty for a
// smooth tone and leaves headroom on the Bluetooth link.
const uint32_t SEND_EVERY_MS = 20;

// Below this signal strength the TF-Luna's distance is unreliable (datasheet).
const uint16_t MIN_STRENGTH = 100;

BLECharacteristic *reading = nullptr;
bool connected = false;

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *server, esp_ble_gatts_cb_param_t *param) override {
    connected = true;
    // Ask the phone for a short connection interval (7.5-15 ms) so readings
    // arrive with little delay. Units are 1.25 ms; the phone may refuse.
    server->updateConnParams(param->connect.remote_bda, 6, 12, 0, 400);
  }
  void onDisconnect(BLEServer *server) override {
    connected = false;
    BLEDevice::startAdvertising();  // be ready for the phone to reconnect
  }
};

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
  }

  uint32_t now = millis();
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
