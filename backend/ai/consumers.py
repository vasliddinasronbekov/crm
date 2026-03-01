# ai/consumers.py
import asyncio
import base64
import json
import os
import tempfile
import uuid
import subprocess
from pathlib import Path

from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings
from ai import services  # mavjud services.py funksiyalar
from ai import intent_handler

FFMPEG_BIN = "ffmpeg"  # yoki to'liq yo'l
# consumers.py ichida
out_wav = await run_in_thread(services.text_to_speech, text)
# out_wav — wav path, keyin uni o'qib stream qilyapsiz

async def run_in_thread(fn, *args, **kwargs):
    return await asyncio.to_thread(fn, *args, **kwargs)

class VoiceConsumer(AsyncWebsocketConsumer):
    """
    WebSocket voice protocol (simple):
      - client sends JSON text messages for control
      - for audio, client sends binary blobs (webm/opus) or base64 messages:
          { "type": "audio", "fmt": "webm", "data": "<base64>" }
      - server sends back interim transcripts as JSON:
          { "type": "transcript", "text": "...", "partial": true }
      - server sends audio binary chunks for TTS:
          binary frames with prefix header JSON then raw wav bytes
    """

    async def connect(self):
        # authenticate if you want: self.scope["user"]
        await self.accept()
        # session state
        self.session_id = str(uuid.uuid4())
        self.buff_file = Path(tempfile.gettempdir()) / f"ai_stream_{self.session_id}.wav"
        # create empty wav buffer (we'll append PCM)
        if self.buff_file.exists():
            self.buff_file.unlink()
        # store last ASR time
        self._last_asr_time = 0
        self._asr_interval = 2.0  # seconds between interim ASR calls
        self._closed = False
        await self.send(json.dumps({"type": "ready", "session": self.session_id}))

    async def disconnect(self, code):
        self._closed = True
        try:
            if self.buff_file.exists():
                self.buff_file.unlink()
        except Exception:
            pass

    async def receive(self, text_data=None, bytes_data=None):
        """
        Expect JSON control messages OR binary audio blobs encoded as webm/base64 in JSON.
        Preferred: client sends JSON: {"type":"audio","fmt":"webm","data":"<base64>"} 
        """
        if text_data:
            try:
                msg = json.loads(text_data)
            except Exception:
                return
            typ = msg.get("type")
            if typ == "audio":
                fmt = msg.get("fmt", "webm")
                data_b64 = msg.get("data")
                await self._handle_audio_chunk_base64(fmt, data_b64)
            elif typ == "control" and msg.get("action") == "end":
                await self._finalize_and_handle()
            else:
                # other controls
                await self.send(json.dumps({"type":"info","msg":"unknown control"}))
        elif bytes_data:
            # alternative: raw binary chunk (assume webm/opus blob)
            # write to tmp and process
            tmp = Path(tempfile.gettempdir()) / f"{uuid.uuid4()}.webm"
            with open(tmp, "wb") as f:
                f.write(bytes_data)
            await run_in_thread(self._append_webm_to_wav, str(tmp))
            tmp.unlink(missing_ok=True)
            # maybe run interim ASR
            await self._maybe_run_asr()

    async def _handle_audio_chunk_base64(self, fmt, data_b64):
        raw = base64.b64decode(data_b64)
        tmp = Path(tempfile.gettempdir()) / f"{uuid.uuid4()}.{fmt}"
        tmp.write_bytes(raw)
        # convert and append to master wav buffer
        await run_in_thread(self._append_webm_to_wav, str(tmp))
        tmp.unlink(missing_ok=True)
        await self._maybe_run_asr()

    def _append_webm_to_wav(self, src_path: str):
        """
        Use ffmpeg to convert src (webm/opus) to 16k WAV and append to buffer WAV.
        Implementation: convert src -> temp wav, then concat with existing buffer using ffmpeg concat.
        Simpler: convert both to same format and use sox/ffmpeg append.
        """
        tmp_wav = Path(tempfile.gettempdir()) / f"tmp_{uuid.uuid4()}.wav"
        # convert to PCM 16k mono
        cmd = [
            FFMPEG_BIN, "-y", "-i", src_path,
            "-ar", "16000", "-ac", "1", "-f", "wav",
            str(tmp_wav)
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        # if master doesn't exist, move tmp_wav -> master
        if not self.buff_file.exists():
            tmp_wav.replace(self.buff_file)
            return
        # else concat: using ffmpeg concat demuxer via a list file
        listfile = Path(tempfile.gettempdir()) / f"list_{uuid.uuid4()}.txt"
        listfile.write_text(f"file '{self.buff_file}'\nfile '{tmp_wav}'\n")
        out_tmp = Path(tempfile.gettempdir()) / f"out_{uuid.uuid4()}.wav"
        cmd2 = [
            FFMPEG_BIN, "-y", "-f", "concat", "-safe", "0", "-i", str(listfile),
            "-c", "copy", str(out_tmp)
        ]
        subprocess.run(cmd2, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        # replace buffer
        out_tmp.replace(self.buff_file)
        listfile.unlink(missing_ok=True)
        tmp_wav.unlink(missing_ok=True)

    async def _maybe_run_asr(self):
        # run ASR every _asr_interval seconds
        now = asyncio.get_event_loop().time()
        if now - self._last_asr_time < self._asr_interval:
            return
        self._last_asr_time = now
        # run transcribe in thread to avoid blocking
        try:
            text, dur = await run_in_thread(services.transcribe_audio, str(self.buff_file))
            # send interim transcript
            await self.send(json.dumps({"type":"transcript","text": text, "partial": True}))
            # optionally if voice ended or punctuation final, finalize
        except Exception as e:
            await self.send(json.dumps({"type":"error","msg": str(e)}))

    async def _finalize_and_handle(self):
        # run final ASR
        try:
            final_text, dur = await run_in_thread(services.transcribe_audio, str(self.buff_file))
        except Exception as e:
            await self.send(json.dumps({"type":"error","msg": str(e)}))
            return
        # extract intent
        nlu = await run_in_thread(services.extract_intent, final_text)
        entities = await run_in_thread(services.extract_entities, final_text)
        nlu["entities"] = entities
        await self.send(json.dumps({"type":"nlu","nlu": nlu}))
        # handle intent (synchronous handler may do DB operations) - run in thread
        result = await run_in_thread(intent_handler.handle_nlu_result_sync, nlu, final_text, self.scope.get("user"))
        await self.send(json.dumps({"type":"result","result": result}))
        # if handler returns TTS text, synthesize and stream
        # assume result contains 'message' field for TTS
        tts_text = result.get("message") or result.get("response")
        if tts_text:
            # synthesize to wav and stream chunks (async)
            await self._synthesize_and_stream(tts_text)

    async def _synthesize_and_stream(self, text):
        """
        Use ai.services.text_to_speech to generate a WAV (blocking), then stream chunks to client.
        For truly streaming/smaller-latency TTS, you would integrate a streaming TTS model.
        Here: generate full wav then stream in small pieces.
        """
        try:
            out_wav = await run_in_thread(services.text_to_speech, text)  # returns path
        except Exception as e:
            await self.send(json.dumps({"type":"error","msg": f"TTS failed: {e}"}))
            return
        # stream WAV in 0.5s chunks
        import soundfile as sf
        data, sr = sf.read(out_wav, dtype="int16")
        chunk_dur = 0.5
        samples_per_chunk = int(sr * chunk_dur)
        i = 0
        while i < len(data) and not self._closed:
            chunk = data[i:i+samples_per_chunk]
            # convert to bytes (wav raw PCM) — send as base64 binary frame with JSON header
            header = json.dumps({"type":"tts_chunk","sr": sr, "dtype":"int16", "samples": len(chunk)})
            await self.send(header)
            # send raw PCM as binary
            await self.send(bytes(chunk.tobytes()))
            i += samples_per_chunk
            await asyncio.sleep(chunk_dur * 0.2)  # throttle (client can buffer)
        # notify finished
        await self.send(json.dumps({"type":"tts_end"}))
