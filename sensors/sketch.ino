#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ── LCD ──────────────────────────────────────────────────────────
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ── WiFi ─────────────────────────────────────────────────────────
const char* SSID     = "Wokwi-GUEST";
const char* PASSWORD = "";

// ── MQTT ─────────────────────────────────────────────────────────
const char* BROKER = "broker.hivemq.com";
const int   PORT   = 1883;
const char* TOPIC  = "biblio/occupation";

// ── Pins ─────────────────────────────────────────────────────────
const int SENSOR_A  = 18;
const int SENSOR_B  = 19;
const int LED_GREEN = 25;
const int LED_RED   = 26;
const int LED_AMBER = 27;

// ── Machine à états ──────────────────────────────────────────────
enum State { IDLE, A_TRIGGERED, B_TRIGGERED };
State currentState = IDLE;
unsigned long triggerTime = 0;
const unsigned long TIMEOUT_MS = 3000;
int occupancy = 0;

// ── LED flash non-bloquant ───────────────────────────────────────
unsigned long ledLastTime    = 0;
int           ledPin         = -1;
int           ledFlashes     = 0;
bool          ledState       = false;
const unsigned long LED_INTERVAL = 150;

// ── Détection de flanc (remplace pressedA / pressedB) ────────────
bool aPrev = false;
bool bPrev = false;

// ── Clients réseau ───────────────────────────────────────────────
WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);

// ─────────────────────────────────────────────────────────────────

void startFlash(int pin, int n) {
  ledPin     = pin;
  ledFlashes = n * 2;
  ledState   = false;
  ledLastTime = millis();
}

void updateFlash() {
  if (ledPin < 0 || ledFlashes <= 0) return;
  if (millis() - ledLastTime < LED_INTERVAL) return;
  ledLastTime = millis();
  ledState    = !ledState;
  digitalWrite(ledPin, ledState ? HIGH : LOW);
  if (--ledFlashes <= 0) {
    digitalWrite(ledPin, LOW);
    ledPin = -1;
  }
}

void showLCD(const char* line1, String line2) {
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print(line1);
  lcd.setCursor(0, 1); lcd.print(line2);
}

// ── Réseau ───────────────────────────────────────────────────────

void connectWifi() {
  showLCD("Connexion WiFi", "...");
  WiFi.begin(SSID, PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(300);
  Serial.println("WiFi OK – " + WiFi.localIP().toString());
  showLCD("WiFi OK", WiFi.localIP().toString());
  delay(800);
}

void connectMqtt() {
  while (!mqtt.connected()) {
    showLCD("Connexion MQTT", "...");
    Serial.print("MQTT...");
    if (mqtt.connect("ESP32_Biblio")) {
      Serial.println(" OK");
    } else {
      Serial.println(" echec rc=" + String(mqtt.state()));
      delay(3000);
    }
  }
}

void publish(const char* event) {
  char payload[80];
  snprintf(payload, sizeof(payload),
    "{\"occupation\":%d,\"event\":\"%s\"}", occupancy, event);
  mqtt.publish(TOPIC, payload);
  Serial.println("-> MQTT : " + String(payload));
}

// ─────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  pinMode(SENSOR_A,  INPUT_PULLUP);
  pinMode(SENSOR_B,  INPUT_PULLUP);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED,   OUTPUT);
  pinMode(LED_AMBER, OUTPUT);

  lcd.init();
  lcd.backlight();
  showLCD("=BiblioFlow=", "Demarrage...");

  connectWifi();
  mqtt.setServer(BROKER, PORT);
  connectMqtt();

  showLCD("=BiblioFlow=", "En attente...");
  Serial.println("=== BiblioFlow pret ===");
}

void loop() {
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  // ── Flancs montants – non-bloquant ───────────────────────────
  bool sA = (digitalRead(SENSOR_A) == LOW);
  bool sB = (digitalRead(SENSOR_B) == LOW);
  bool tA = sA && !aPrev;   // vrai uniquement au moment de l'appui
  bool tB = sB && !bPrev;
  aPrev = sA;
  bPrev = sB;

  // ── Timeout ──────────────────────────────────────────────────
  if (currentState != IDLE && millis() - triggerTime > TIMEOUT_MS) {
    digitalWrite(LED_AMBER, LOW);
    currentState = IDLE;
    showLCD("TIMEOUT", "Demi-tour!");
    Serial.println("[TIMEOUT] Occ=" + String(occupancy));
  }

  // ── Machine à états ──────────────────────────────────────────
  switch (currentState) {

    case IDLE:
      if (tA) {
        currentState = A_TRIGGERED;
        triggerTime  = millis();
        digitalWrite(LED_AMBER, HIGH);
        showLCD("Capteur A actif", "Attente B...");
        Serial.println("[A] Exterieur -> attente B...");
      } else if (tB) {
        currentState = B_TRIGGERED;
        triggerTime  = millis();
        digitalWrite(LED_AMBER, HIGH);
        showLCD("Capteur B actif", "Attente A...");
        Serial.println("[B] Interieur -> attente A...");
      }
      break;

    case A_TRIGGERED:
      if (tB) {                          // A puis B → ENTRÉE
        occupancy++;
        digitalWrite(LED_AMBER, LOW);
        currentState = IDLE;
        showLCD("ENTREE +1 !", "Occ=" + String(occupancy) + " pers.");
        startFlash(LED_GREEN, 3);
        publish("entry");
        Serial.println("[OK] ENTREE! Occ=" + String(occupancy));
      } else if (tA) {                   // A à nouveau → demi-tour
        triggerTime = millis();
        showLCD("Demi-tour A", "Reset timeout");
        Serial.println("[DEMI-TOUR] reset");
      }
      break;

    case B_TRIGGERED:
      if (tA) {                          // B puis A → SORTIE
        if (occupancy > 0) occupancy--;
        digitalWrite(LED_AMBER, LOW);
        currentState = IDLE;
        showLCD("SORTIE -1 !", "Occ=" + String(occupancy) + " pers.");
        startFlash(LED_RED, 3);
        publish("exit");
        Serial.println("[OK] SORTIE! Occ=" + String(occupancy));
      } else if (tB) {                   // B à nouveau → demi-tour
        triggerTime = millis();
        showLCD("Demi-tour B", "Reset timeout");
        Serial.println("[DEMI-TOUR] reset");
      }
      break;
  }

  updateFlash();
  delay(10);
}
