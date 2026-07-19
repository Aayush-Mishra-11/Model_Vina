"""Streaming STT — buffers WebM/Opus chunks and produces partial transcripts.

The browser MediaRecorder emits ~250 ms Opus chunks while the user is
speaking. We accumulate them in a per-connection buffer and, on a
configurable cadence (default every 1.2 s), decode the buffer with
faster-whisper and push a `partial` event back. The final buffer at
`stop` time produces a `final` event.

This module is deliberately model-agnostic: it calls
`transcribe_audio_full` so the same Whisper tiny.en model powers both
the streaming and the batch paths. The trade-off is that we re-decode
the entire buffer for every partial — fine at 16 kHz mono and tiny.en
on CPU, which decodes a 1-2 s chunk in ~150-300 ms.

For production you'd swap in `faster-whisper`'s `transcribe` with
incremental timestamps or use `whisper_streaming` / `WhisperLive`. For
the demo this is plenty.
"""

import asyncio
import io
import logging
import os
import tempfile
import time
import wave
from dataclasses import dataclass, field
from typing import AsyncIterator, List, Optional

logger = logging.getLogger(__name__)

# Audio parameters we standardize on. Browsers usually record 48 kHz Opus;
# we re-encode to 16 kHz mono PCM so Whisper stays happy.
SAMPLE_RATE = 16000
CHANNELS = 1
SAMPLE_WIDTH = 2  # 16-bit PCM

# How often (seconds) to push a partial transcript while the user is
# still talking. Too small = wasted CPU; too large = laggy subtitles.
PARTIAL_INTERVAL_S = 1.2

# Maximum accumulated audio we will buffer. Once we exceed this we
# flush the earliest seconds. Prevents runaway memory if the user
# forgets to stop recording.
MAX_BUFFER_SECONDS = 30.0


@dataclass
class StreamState:
    """Per-WebSocket-connection state for a streaming session."""
    user_id: Optional[str] = None
    chunks: List[bytes] = field(default_factory=list)  # raw bytes per chunk (Opus/WebM/WAV)
    pcm_frames: List[bytes] = field(default_factory=list)  # decoded 16k mono PCM frames
    sample_rate: int = SAMPLE_RATE
    started_at: float = 0.0
    last_partial_at: float = 0.0
    last_partial_text: str = ""
    closed: bool = False
    total_pcm_seconds: float = 0.0

    def add_chunk(self, raw: bytes) -> None:
        """Append a media chunk and try to decode it into PCM."""
        if not raw:
            return
        self.chunks.append(raw)
        # We try to decode synchronously. If the chunk is in a container
        # the decoder falls back to writing-to-tempfile + soundfile.
        pcm = _decode_to_pcm(raw, target_rate=self.sample_rate)
        if pcm is not None:
            self.pcm_frames.append(pcm)
            self.total_pcm_seconds += len(pcm) / (self.sample_rate * SAMPLE_WIDTH * CHANNELS)
            # Cap the buffer size
            max_frames = int(MAX_BUFFER_SECONDS * self.sample_rate * SAMPLE_WIDTH * CHANNELS)
            total = sum(len(f) for f in self.pcm_frames)
            while total > max_frames and self.pcm_frames:
                dropped = self.pcm_frames.pop(0)
                total -= len(dropped)
                self.total_pcm_seconds -= len(dropped) / (self.sample_rate * SAMPLE_WIDTH * CHANNELS)

    def assemble_wav(self) -> Optional[bytes]:
        """Concatenate decoded PCM into a single WAV blob for Whisper."""
        if not self.pcm_frames:
            return None
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(SAMPLE_WIDTH)
            wf.setframerate(self.sample_rate)
            wf.writeframes(b"".join(self.pcm_frames))
        return buf.getvalue()

    def reset_partial_state(self) -> None:
        self.last_partial_at = 0.0
        self.last_partial_text = ""


def _decode_to_pcm(raw: bytes, target_rate: int = SAMPLE_RATE) -> Optional[bytes]:
    """Decode a raw audio chunk (WAV, WebM/Opus, or raw PCM) to 16k mono PCM.

    Strategy:
      1. Try `soundfile` (libsndfile) — handles WAV, FLAC, OGG, etc.
      2. Try `pydub` if installed — handles WebM/Opus via ffmpeg.
      3. Try to interpret as raw 16-bit PCM (WebM MediaRecorder sometimes
         emits raw frames in some browsers).
    Returns None if decoding fails.
    """
    if not raw or len(raw) < 4:
        return None

    # 1) soundfile path (libsndfile) — WAV, FLAC, OGG (Vorbis), etc.
    try:
        import soundfile as sf
        import numpy as np
        with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as tmp:
            tmp.write(raw)
            tmp_path = tmp.name
        try:
            data, sr = sf.read(tmp_path, always_2d=False, dtype="float32")
        finally:
            try:
                os.remove(tmp_path)
            except OSError:
                pass
        if data.ndim > 1:
            data = data.mean(axis=1)
        if sr != target_rate:
            # Linear resample — good enough for 48k -> 16k.
            n_out = int(len(data) * target_rate / sr)
            if n_out <= 0:
                return None
            xp = np.linspace(0, 1, len(data))
            x = np.linspace(0, 1, n_out)
            data = np.interp(x, xp, data)
        # Convert float32 [-1, 1] -> int16 bytes
        pcm = (data * 32767.0).clip(-32768, 32767).astype("int16").tobytes()
        return pcm
    except Exception:
        pass

    # 2) pydub path (needs ffmpeg on PATH for Opus)
    try:
        from pydub import AudioSegment
        with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as tmp:
            tmp.write(raw)
            tmp_path = tmp.name
        try:
            seg = AudioSegment.from_file(tmp_path)
        finally:
            try:
                os.remove(tmp_path)
            except OSError:
                pass
        seg = seg.set_channels(CHANNELS).set_frame_rate(target_rate).set_sample_width(SAMPLE_WIDTH)
        return seg.raw_data
    except Exception:
        pass

    # 3) Heuristic: maybe it's a raw PCM chunk at our target rate/channels.
    # We can't be sure of the sample rate, so only use this for round sizes.
    if len(raw) % SAMPLE_WIDTH == 0:
        # Assume it's already 16k mono int16.
        return raw
    return None


async def stream_transcripts(
    state: StreamState,
    emit,
    *,
    on_final=None,
) -> None:
    """Pump partial + final transcripts for a single WebSocket session.

    `emit` is an async callable (e.g. `websocket.send_json`) that
    delivers a dict payload to the client.
    `on_final` is an optional coroutine called once with the final WAV
    bytes — useful for wiring to /api/speech/analyze at the end of a
    practice session.
    """
    try:
        from server.converters.stt import transcribe_audio_full
    except (ImportError, ModuleNotFoundError):
        try:
            from ..converters.stt import transcribe_audio_full
        except (ImportError, ModuleNotFoundError):
            from converters.stt import transcribe_audio_full

    state.started_at = time.time()
    state.last_partial_at = state.started_at

    try:
        partial_count = 0
        while not state.closed:
            now = time.time()
            if now - state.last_partial_at >= PARTIAL_INTERVAL_S and state.pcm_frames:
                wav = state.assemble_wav()
                if wav:
                    logger.info(
                        "streaming: pumping partial #%d (%.2fs of audio, %d PCM bytes)",
                        partial_count, state.total_pcm_seconds, sum(len(f) for f in state.pcm_frames),
                    )
                    try:
                        # Whisper decode runs the model synchronously.
                        result = await asyncio.to_thread(transcribe_audio_full, wav, "en")
                        text = (result.text or "").strip()
                        if text and text != state.last_partial_text:
                            state.last_partial_text = text
                            await emit({
                                "type": "partial",
                                "text": text,
                                "duration": round(state.total_pcm_seconds, 2),
                                "timestamp": now,
                            })
                        partial_count += 1
                    except Exception as exc:
                        logger.warning("streaming: partial decode failed: %s", exc)
                state.last_partial_at = now
            await asyncio.sleep(0.15)
    except asyncio.CancelledError:
        # Client disconnected mid-stream — that's fine.
        logger.info("streaming: cancelled")
        raise
    except Exception as exc:
        logger.exception("streaming: pump failed: %s", exc)
        try:
            await emit({"type": "error", "message": str(exc)})
        except Exception:
            pass

    # Final pass — emit the definitive transcript.
    wav = state.assemble_wav()
    if wav:
        try:
            result = await asyncio.to_thread(transcribe_audio_full, wav, "en")
            text = (result.text or "").strip()
            await emit({
                "type": "final",
                "text": text,
                "duration": round(state.total_pcm_seconds, 2),
                "segments": [
                    {"start": s.start, "end": s.end, "text": s.text}
                    for s in (result.segments or [])
                ],
            })
            if on_final is not None:
                try:
                    await on_final(wav, text)
                except Exception as exc:
                    logger.warning("streaming: on_final hook failed: %s", exc)
        except Exception as exc:
            logger.warning("streaming: final decode failed: %s", exc)
            await emit({"type": "error", "message": str(exc)})
    else:
        await emit({"type": "final", "text": "", "duration": 0.0, "segments": []})
