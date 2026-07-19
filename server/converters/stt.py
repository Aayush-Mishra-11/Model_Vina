"""STT module — wraps `faster-whisper` (CTranslate2 port of OpenAI Whisper).

faster-whisper is the recommended production choice:
  * ~4x faster than openai-whisper on CPU
  * ~half the RAM (int8 quantization)
  * Same tiny.en accuracy as the original

faster-whisper uses PyAV (the `av` package) for audio decoding, so the
heavyweight `ffmpeg` system binary is not required. If you prefer
ffmpeg-backed decoding, install ffmpeg and switch `ffmpeg` to `"auto"` —
otherwise leave the default.
"""

import os
import tempfile
import logging
import base64
import requests
from dataclasses import dataclass, field
from typing import List
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

_model = None


def get_transcription_model():
    """Lazy-load the tiny.en Whisper model. The first call downloads ~75 MB."""
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        # int8 quantization cuts memory use in half with negligible quality loss.
        # `cpu` works on every machine; switch to `cuda` if you have a GPU.
        _model = WhisperModel('tiny.en', device='cpu', compute_type='int8')
    return _model


@dataclass
class TranscriptionSegment:
    """A single timed segment of speech."""
    start: float
    end: float
    text: str


@dataclass
class TranscriptionResult:
    """A complete transcription with per-segment timestamps."""
    text: str
    duration: float
    segments: List[TranscriptionSegment] = field(default_factory=list)

    @property
    def speech_duration(self) -> float:
        """Total seconds of actual speech (sum of segment durations)."""
        return max(0.0, sum(max(0.0, s.end - s.start) for s in self.segments))

    @property
    def silence_duration(self) -> float:
        """Audio duration minus speech duration (silence + pauses)."""
        return max(0.0, self.duration - self.speech_duration)

    @property
    def pause_count(self) -> int:
        """Number of silent gaps between segments."""
        if len(self.segments) < 2:
            return 0
        count = 0
        for i in range(1, len(self.segments)):
            gap = self.segments[i].start - self.segments[i - 1].end
            if gap >= 0.3:  # count gaps ≥ 300ms
                count += 1
        return count


def transcribe_audio_bytes(audio_bytes: bytes, language: str = 'en') -> tuple[str, float]:
    """Transcribe an audio blob to text.

    Returns (transcript, duration_seconds) — kept stable for callers that
    only need those two values. For per-segment timestamps use
    `transcribe_audio_full` instead.
    """
    result = transcribe_audio_full(audio_bytes, language=language)
    return result.text, result.duration


def _transcribe_cloud(audio_bytes: bytes, language: str = 'en') -> TranscriptionResult | None:
    # 1. Try Groq Whisper API
    if GROQ_API_KEY:
        try:
            url = "https://api.groq.com/openai/v1/audio/transcriptions"
            headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}
            files = {"file": ("audio.wav", audio_bytes, "audio/wav")}
            data = {
                "model": "whisper-large-v3",
                "language": language,
                "response_format": "verbose_json"
            }
            response = requests.post(url, headers=headers, files=files, data=data, timeout=30)
            response.raise_for_status()
            res_json = response.json()
            text = res_json.get("text", "").strip()
            duration = float(res_json.get("duration", 0.0))
            segments_raw = res_json.get("segments", [])
            segments = [
                TranscriptionSegment(
                    start=float(s.get("start", 0.0)),
                    end=float(s.get("end", 0.0)),
                    text=s.get("text", "").strip()
                )
                for s in segments_raw
            ]
            return TranscriptionResult(text=text, duration=duration, segments=segments)
        except Exception as e:
            logger.warning(f"Groq Whisper STT failed: {e}")

    # 2. Try OpenAI Whisper API
    if OPENAI_API_KEY:
        try:
            url = "https://api.openai.com/v1/audio/transcriptions"
            headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
            files = {"file": ("audio.wav", audio_bytes, "audio/wav")}
            data = {
                "model": "whisper-1",
                "language": language,
                "response_format": "verbose_json"
            }
            response = requests.post(url, headers=headers, files=files, data=data, timeout=30)
            response.raise_for_status()
            res_json = response.json()
            text = res_json.get("text", "").strip()
            duration = float(res_json.get("duration", 0.0))
            segments_raw = res_json.get("segments", [])
            segments = [
                TranscriptionSegment(
                    start=float(s.get("start", 0.0)),
                    end=float(s.get("end", 0.0)),
                    text=s.get("text", "").strip()
                )
                for s in segments_raw
            ]
            return TranscriptionResult(text=text, duration=duration, segments=segments)
        except Exception as e:
            logger.warning(f"OpenAI Whisper STT failed: {e}")

    # 3. Try Gemini audio API
    if GEMINI_API_KEY:
        try:
            b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={GEMINI_API_KEY}"
            payload = {
                "contents": [{
                    "parts": [
                        {
                            "inlineData": {
                                "mimeType": "audio/wav",
                                "data": b64_audio
                            }
                        },
                        {
                            "text": "Transcribe this audio clip exactly. Return only the transcription text, nothing else."
                        }
                    ]
                }]
            }
            response = requests.post(url, json=payload, timeout=30)
            response.raise_for_status()
            res_json = response.json()
            text = res_json['candidates'][0]['content']['parts'][0]['text'].strip()
            
            # Estimate duration
            duration = 5.0
            try:
                import soundfile as sf
                import io
                data_arr, sr = sf.read(io.BytesIO(audio_bytes))
                duration = len(data_arr) / sr
            except Exception:
                pass
                
            segments = [TranscriptionSegment(start=0.0, end=duration, text=text)]
            return TranscriptionResult(text=text, duration=duration, segments=segments)
        except Exception as e:
            logger.warning(f"Gemini audio STT failed: {e}")

    return None


def transcribe_audio_full(audio_bytes: bytes, language: str = 'en') -> TranscriptionResult:
    """Transcribe an audio blob and return per-segment timestamps + audio duration.

    Checks cloud endpoints first if keys are configured, otherwise falls back
    to local faster-whisper.
    """
    cloud_result = _transcribe_cloud(audio_bytes, language=language)
    if cloud_result is not None:
        return cloud_result

    # Local fallback:
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
        temp_file.write(audio_bytes)
        temp_path = temp_file.name

    try:
        model = get_transcription_model()
        segments_iter, info = model.transcribe(
            temp_path,
            language=language,
            beam_size=1,           # greedy — fastest, fine for tiny.en
            vad_filter=True,       # skip silence, reduces hallucinated text
        )
        segments: List[TranscriptionSegment] = []
        text_parts: List[str] = []
        for seg in segments_iter:
            segments.append(
                TranscriptionSegment(
                    start=float(seg.start),
                    end=float(seg.end),
                    text=seg.text.strip(),
                )
            )
            if seg.text.strip():
                text_parts.append(seg.text.strip())

        duration = float(info.duration) if info and info.duration else 0.0
        return TranscriptionResult(
            text=" ".join(text_parts).strip(),
            duration=duration,
            segments=segments,
        )
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass
