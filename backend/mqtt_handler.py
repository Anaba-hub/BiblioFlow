import json
import paho.mqtt.client as mqtt

from database import insert_event

BROKER = "broker.hivemq.com"
PORT   = 1883
TOPIC  = "biblio/occupation"

class MQTTHandler:
    def __init__(self, on_message_callback):
        self._callback = on_message_callback
        self._client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION1, "FastAPI_Biblio"
        )
        self._client.on_connect = self._on_connect
        self._client.on_message = self._on_message

    def _on_connect(self, client, userdata, flags, rc):
        print(f"[MQTT] Connecté (rc={rc})")
        client.subscribe(TOPIC)

    def _on_message(self, client, userdata, message):
        try:
            payload    = json.loads(message.payload.decode())
            event_type = payload.get("event")
            occupation = payload.get("occupation")

            if event_type and occupation is not None:
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
