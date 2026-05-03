/*
 * Remote Security System — ESP32 Firmware
 * --------------------------------------------------------------
 * Hardware:
 *   GPIO 13  PIR sensor OUT       (input)
 *   GPIO 18  Servo signal         (PWM out)
 *   GPIO 19  Buzzer transistor    (digital out)
 *   GPIO 22  Red LED  (locked)    (digital out)
 *   GPIO 23  Green LED (unlocked) (digital out)
 *
 * Required Arduino libraries (Library Manager):
 *   - WebSockets   by Markus Sattler   (>= 2.4.x)
 *   - ArduinoJson  by Benoit Blanchon  (>= 6.x)
 *   - ESP32Servo   by Kevin Harrington (>= 1.x)
 *
 * Behavior:
 *   - PIR HIGH triggers buzzer + HTTP POST /api/motion (debounced).
 *   - WebSocket /ws?role=device receives commands from the server:
 *       { "type": "lock" | "unlock" | "silence" }
 *   - Auto-reconnects WiFi and WebSocket on drop.
 *   - Boots in LOCKED state with the buzzer OFF.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

// =====================================================================
// CONFIG  — edit these for your network and laptop IP
// =====================================================================
static const char*    WIFI_SSID    = "YOUR_WIFI_SSID";
static const char*    WIFI_PASS    = "YOUR_WIFI_PASSWORD";
static const char*    SERVER_HOST  = "192.168.1.100";   // your laptop's LAN IP
static const uint16_t SERVER_PORT  = 3000;
static const char*    MOTION_PATH  = "/api/motion";
static const char*    WS_PATH      = "/ws?role=device";

// =====================================================================
// PINS
// =====================================================================
static const int PIN_PIR        = 13;
static const int PIN_BUZZER     = 19;
static const int PIN_SERVO      = 18;
static const int PIN_LED_RED    = 22;   // locked
static const int PIN_LED_GREEN  = 23;   // unlocked

// =====================================================================
// TUNING
// =====================================================================
static const unsigned long PIR_WARMUP_MS      = 30000;  // PIR settles for ~30s
static const unsigned long MOTION_COOLDOWN_MS = 8000;   // min gap between events
static const int           SERVO_LOCKED_DEG   = 0;
static const int           SERVO_UNLOCKED_DEG = 90;

// =====================================================================
// STATE
// =====================================================================
WebSocketsClient webSocket;
Servo            doorServo;

bool          doorLocked     = true;
bool          buzzerActive   = false;
bool          wsConnected    = false;
unsigned long lastMotionMs   = 0;
unsigned long bootMs         = 0;
unsigned long lastWiFiCheck  = 0;

// =====================================================================
// HELPERS
// =====================================================================
void setBuzzer(bool on) {
  buzzerActive = on;
  digitalWrite(PIN_BUZZER, on ? HIGH : LOW);
  Serial.printf("[BUZZER] %s\n", on ? "ON" : "OFF");
}

void setLock(bool locked) {
  doorLocked = locked;
  doorServo.write(locked ? SERVO_LOCKED_DEG : SERVO_UNLOCKED_DEG);
  digitalWrite(PIN_LED_RED,   locked ? HIGH : LOW);
  digitalWrite(PIN_LED_GREEN, locked ? LOW  : HIGH);
  Serial.printf("[DOOR] %s\n", locked ? "LOCKED" : "UNLOCKED");
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("[WIFI] Connecting to %s ...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(250);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[WIFI] Connected. IP = %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("[WIFI] Failed; will retry.");
  }
}

void postMotionEvent() {
  if (WiFi.status() != WL_CONNECTED) return;

  String url = String("http://") + SERVER_HOST + ":" + SERVER_PORT + MOTION_PATH;
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(3000);

  int code = http.POST("{}");
  Serial.printf("[HTTP] POST %s -> %d\n", url.c_str(), code);
  http.end();
}

void handleCommand(const char* type) {
  if (strcmp(type, "lock") == 0) {
    setLock(true);
  } else if (strcmp(type, "unlock") == 0) {
    setLock(false);
    setBuzzer(false);   // unlocking implicitly silences any active alarm
  } else if (strcmp(type, "silence") == 0) {
    setBuzzer(false);
  } else {
    Serial.printf("[WS] Unknown command: %s\n", type);
  }
}

void onWsEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      wsConnected = true;
      Serial.println("[WS] Connected to server");
      break;
    case WStype_DISCONNECTED:
      wsConnected = false;
      Serial.println("[WS] Disconnected");
      break;
    case WStype_TEXT: {
      StaticJsonDocument<256> doc;
      DeserializationError err = deserializeJson(doc, payload, length);
      if (err) {
        Serial.printf("[WS] JSON parse error: %s\n", err.c_str());
        return;
      }
      const char* msgType = doc["type"] | "";
      Serial.printf("[WS] <- %s\n", msgType);
      handleCommand(msgType);
      break;
    }
    default:
      break;
  }
}

// =====================================================================
// SETUP / LOOP
// =====================================================================
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n[BOOT] Remote Security System");

  pinMode(PIN_PIR,       INPUT);
  pinMode(PIN_BUZZER,    OUTPUT);
  pinMode(PIN_LED_RED,   OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  // Servo on standard 50 Hz / 1000-2000 us range
  doorServo.setPeriodHertz(50);
  doorServo.attach(PIN_SERVO, 500, 2400);

  setLock(true);
  setBuzzer(false);

  bootMs = millis();
  connectWiFi();

  webSocket.begin(SERVER_HOST, SERVER_PORT, WS_PATH);
  webSocket.onEvent(onWsEvent);
  webSocket.setReconnectInterval(3000);
  webSocket.enableHeartbeat(15000, 3000, 2);
}

void loop() {
  // 1) WiFi watchdog (every 5s)
  if (millis() - lastWiFiCheck > 5000) {
    lastWiFiCheck = millis();
    if (WiFi.status() != WL_CONNECTED) connectWiFi();
  }

  // 2) WebSocket pump
  webSocket.loop();

  // 3) Motion detection (after warmup + cooldown)
  if (millis() - bootMs > PIR_WARMUP_MS) {
    if (digitalRead(PIN_PIR) == HIGH &&
        millis() - lastMotionMs > MOTION_COOLDOWN_MS) {
      lastMotionMs = millis();
      Serial.println("[PIR] Motion detected");
      setBuzzer(true);
      postMotionEvent();
    }
  }
}
