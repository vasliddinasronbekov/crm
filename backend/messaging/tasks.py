# messaging/tasks.py
from celery import shared_task
import base64
import uuid
from django.conf import settings
from channels.layers import get_channel_layer
import requests
import json

@shared_task(bind=True)
def process_voice_chunk(self, payload):
    """
    payload example:
    {
       "chunk_id":"uuid",
       "data":"base64-audio",
       "seq":1,
       "room":"ai_room_..."
    }
    """
    try:
        chunk_id = payload.get("chunk_id") or str(uuid.uuid4())
        audio_b64 = payload.get("data")
        room = payload.get("room")

        # decode and save to temporary file (or stream to STT)
        audio_bytes = base64.b64decode(audio_b64)
        tmp_path = f"/tmp/{chunk_id}.wav"
        with open(tmp_path, "wb") as f:
            f.write(audio_bytes)

        # --- STT call (placeholder) ---
        # Replace with actual STT service call (Whisper/Cloud STT)
        # For demo: call self.hosted STT microservice:
        # stt_resp = requests.post("http://stt-service/transcribe", files={"file": open(tmp_path,"rb")})
        # text = stt_resp.json().get("text")

        text = "placeholder transcript for demo"

        # send interim/final transcript back to group via channel layer
        channel_layer = get_channel_layer()
        channel_layer.group_send(room, {
            "type": "broadcast.message",
            "message": {"type":"stt_result", "text": text, "final": True, "chunk_id": chunk_id}
        })

        # --- Intent extraction (LLM call) ---
        # For cost control, first run a lightweight rule-based extractor.
        intent_payload = {
            "type": "intent",
            "name": "parse_demo",
            "entities": {"raw_text": text}
        }
        channel_layer.group_send(room, {
            "type": "broadcast.message",
            "message": intent_payload
        })
        return {"status":"ok"}
    except Exception as e:
        self.retry(exc=e, countdown=5, max_retries=3)
