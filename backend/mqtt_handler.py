import json
import os
import paho.mqtt.client as mqtt

from database import insert_event

BROKER        = "broker.hivemq.com"
PORT          = 1883
TOPIC         = "biblio/occupation"
MAX_OCCUPANCY = int(os.getenv("MAX_OCCUPANCY", "500"))
VALID_EVENTS  = {"entry", "exit", "timeout", "half_turn"}

class MQTTHandler:
    def __init__(self, on_message_callback):
        self._callback  = on_message_callback
        self._connected = False
        self._client    = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION1, "FastAPI_Biblio"
        )

        user = os.getenv("MQTT_USER", "")
        if user:
            self._client.username_pw_set(user, os.getenv("MQTT_PASSWORD", ""))

        self._client.on_connect    = self._on_connect
        self._client.on_disconnect = self._on_disconnect
        self._client.on_message    = self._on_message

    @property
    def is_connected(self) -> bool:
        return self._connected

    def _on_connect(self, client, userdata, flags, rc):
        self._connected = rc == 0
        print(f"[MQTT] Connecté (rc={rc})")
        if rc == 0:
            client.subscribe(TOPIC)

    def _on_disconnect(self, client, userdata, rc):
        self._connected = False
        print(f"[MQTT] Déconnecté (rc={rc})")

    def _on_message(self, client, userdata, message):
        try:
            payload    = json.loads(message.payload.decode())
            event_type = payload.get("event")
            occupation = payload.get("occupation")

            if event_type not in VALID_EVENTS:
                print(f"[MQTT] Payload rejeté — event invalide : {event_type!r}")
                return
            if not isinstance(occupation, int) or not (0 <= occupation <= MAX_OCCUPANCY):
                print(f"[MQTT] Payload rejeté — occupation invalide : {occupation!r}")
                return

            insert_event(event_type, occupation)
            print(f"[MQTT] {event_type} → occupation={occupation}")
            self._callback(payload)

        except Exception as e:
            print(f"[MQTT] Erreur parsing : {e}")

    def start(self):
        self._client.connect(BROKER, PORT)
        self._client.loop_start()
        print(f"[MQTT] Abonné à {TOPIC}")

    def stop(self):
        self._client.loop_stop()
        self._client.disconnect()
