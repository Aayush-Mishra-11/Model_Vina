"""Phoneme-level pronunciation scoring with Wav2Vec 2.0.

Approach
--------
1. Load `facebook/wav2vec2-base-960h` (CTC, pre-trained on 960h of LibriSpeech
   English). First call downloads ~360 MB. Subsequent calls use the cache.
2. Read the user's audio with `soundfile` and resample to 16 kHz mono.
3. Tokenize the reference transcript (the Whisper transcript) with the
   model's tokenizer. The tokenizer also gives a CTC "alignment" — the
   subword ids that the forced-alignment step expects.
4. Run the Wav2Vec2 forward pass and apply the log-softmax to get frame-level
   log-probabilities over the vocabulary.
5. For each token in the reference, find the frame with the highest log-prob
   of that token in the audio. The score is the mean of those peak log-probs.
6. Map the mean log-probability to a 0–100 scale using an empirically chosen
   linear calibration. (No-GoS-style fine-tuned model is available locally.)

Failure modes
-------------
* Audio is empty / unreadable → returns None.
* Transcript is empty / only punctuation → returns None.
* The transformers / torch backend isn't installed → returns None.
* Any exception during inference → returns None and logs a warning.

The caller (pipeline.py) is expected to fall back to its heuristic score
when this module returns None.
"""

from __future__ import annotations

import contextlib
import io
import logging
import math
import os
import re
import tempfile
import threading
from typing import List, Optional, Tuple

import numpy as np
import soundfile as sf

logger = logging.getLogger(__name__)

# Tiny no-op context manager for `with ... if hasattr(...) else _nullcontext()`.
_nullcontext = contextlib.nullcontext

# Lazy module-level state — model + processor are loaded on first use only.
_lock = threading.Lock()
_model = None
_processor = None
_load_attempted = False
_load_error: Optional[str] = None

MODEL_ID = os.getenv("WAV2VEC_MODEL", "facebook/wav2vec2-base-960h")


# ----------------------------------------------------------------------
# Public API
# ----------------------------------------------------------------------

def score_pronunciation(
    audio_bytes: bytes,
    reference_text: str,
    audio_duration: float = 0.0,
) -> Optional[int]:
    """Return a 0–100 pronunciation score for the audio vs. the reference.

    Returns None if the model isn't available or the inputs are unusable.
    """
    if not reference_text or not reference_text.strip():
        return None
    if not audio_bytes:
        return None

    model, processor = _get_model()
    if model is None or processor is None:
        return None

    try:
        samples, sr = _decode_audio(audio_bytes)
    except Exception as exc:
        logger.warning("wav2vec: audio decode failed: %s", exc)
        return None

    if samples is None or len(samples) == 0:
        return None

    # Resample to 16 kHz mono if needed.
    if sr != 16000 or samples.ndim > 1:
        samples = _resample_mono_16k(samples, sr)

    # Tokenize the reference — keep only characters in the vocab.
    cleaned = _clean_for_ctc(reference_text)
    if not cleaned:
        return None

    try:
        # Newer transformers (v5) removed `as_target_processor`; call the
        # tokenizer directly. Wav2Vec2Processor's .tokenizer is the
        # Wav2Vec2CTCTokenizer, which expects either a list of strings or
        # `is_split_into_words=True` + a list of word strings.
        tokenizer = getattr(_processor, "tokenizer", _processor)
        try:
            enc = tokenizer(cleaned.split(" "), is_split_into_words=True)
        except TypeError:
            # Older tokenizers that still accept a single string in this mode.
            enc = tokenizer(cleaned)
        labels = enc.get("input_ids", [])
        flat_labels: List[int] = []
        for item in labels:
            if isinstance(item, (list, tuple)):
                flat_labels.extend(int(x) for x in item)
            else:
                try:
                    flat_labels.extend(int(x) for x in item.tolist())
                except AttributeError:
                    flat_labels.append(int(item))
        # CTC blank id (typically 0) is the pad token in Wav2Vec2 — strip them.
        pad_id = getattr(tokenizer, "pad_token_id", 0) or 0
        token_ids: List[int] = [t for t in flat_labels if t != pad_id]
        if not token_ids:
            return None
    except Exception as exc:
        logger.warning("wav2vec: tokenize failed: %s", exc)
        return None

    try:
        import torch
        inputs = processor(
            samples,
            sampling_rate=16000,
            return_tensors="pt",
            padding=True,
        )
        with torch.no_grad():
            logits = model(**inputs).logits
        log_probs = torch.log_softmax(logits, dim=-1)[0]  # [T, V]
        # For each target token, find the frame with the highest log-prob
        # of that token. Mean over tokens = alignment-quality score.
        token_log_probs: List[float] = []
        for tid in token_ids:
            if tid < 0 or tid >= log_probs.shape[-1]:
                continue
            best = float(log_probs[:, tid].max().item())
            token_log_probs.append(best)
        if not token_log_probs:
            return None
        mean_lp = sum(token_log_probs) / len(token_log_probs)
    except Exception as exc:
        logger.warning("wav2vec: inference failed: %s", exc)
        return None

    # Linear calibration: typical good English speech averages ~ -2 to -3 nats
    # on Wav2Vec2-base-960h. -6 nats or worse is garbled. Map [-7, -1] → [0, 100].
    score = _calibrate_to_100(mean_lp)
    return int(max(0, min(100, round(score))))


def is_available() -> bool:
    """True if the model is loaded (or loadable on this machine)."""
    model, processor = _get_model()
    return model is not None and processor is not None


def last_load_error() -> Optional[str]:
    """Return the most recent load error (for diagnostics)."""
    return _load_error


# ----------------------------------------------------------------------
# Internal helpers
# ----------------------------------------------------------------------

def _get_model():
    """Lazy-load the Wav2Vec2 model + processor (thread-safe)."""
    global _model, _processor, _load_attempted, _load_error
    if _load_attempted:
        return _model, _processor
    with _lock:
        if _load_attempted:
            return _model, _processor
        _load_attempted = True
        try:
            from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

            # If the model is already cached locally, prefer offline mode so
            # intermittent network failures don't kill the load.
            try:
                from huggingface_hub import try_to_load_from_cache
                cached = try_to_load_from_cache(MODEL_ID, "config.json")
                if cached is not None and cached != "_not_found_":
                    os.environ.setdefault("HF_HUB_OFFLINE", "1")
                    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
            except Exception:
                pass

            _processor = Wav2Vec2Processor.from_pretrained(MODEL_ID)
            _model = Wav2Vec2ForCTC.from_pretrained(MODEL_ID)
            _model.eval()
            _load_error = None
            logger.info("wav2vec: loaded %s", MODEL_ID)
        except Exception as exc:
            _model = None
            _processor = None
            _load_error = str(exc)
            logger.warning("wav2vec: model load failed: %s", exc)
        return _model, _processor


def _decode_audio(audio_bytes: bytes) -> Tuple[Optional[np.ndarray], int]:
    """Decode any audio container (wav, webm via soundfile+libsndfile) to numpy."""
    try:
        data, sr = sf.read(io.BytesIO(audio_bytes), always_2d=False)
    except Exception:
        # soundfile can't read webm/ogg from MediaRecorder. Fall back to ffmpeg
        # via pydub if available; otherwise re-raise.
        try:
            from pydub import AudioSegment  # type: ignore
            seg = AudioSegment.from_file(io.BytesIO(audio_bytes))
            sr = seg.frame_rate
            arr = np.array(seg.get_array_of_samples(), dtype=np.float32)
            if seg.channels > 1:
                arr = arr.reshape((-1, seg.channels)).mean(axis=1)
            arr = arr / max(1.0, float(1 << (8 * seg.sample_width - 1)))
            return arr, sr
        except Exception as exc:
            raise RuntimeError(f"audio decode failed: {exc}") from exc
    if data.ndim > 1:
        data = data.mean(axis=1)
    return data.astype(np.float32, copy=False), int(sr)


def _resample_mono_16k(samples: np.ndarray, sr: int) -> np.ndarray:
    """Bring audio to 16 kHz mono float32. Uses scipy if available."""
    if sr == 16000:
        return samples
    try:
        from scipy.signal import resample_poly
        # 16k / sr in lowest terms.
        from math import gcd
        g = gcd(16000, sr)
        up = 16000 // g
        down = sr // g
        return resample_poly(samples, up, down).astype(np.float32, copy=False)
    except Exception:
        # Linear interpolation fallback.
        duration = len(samples) / float(sr)
        target_len = int(duration * 16000)
        if target_len <= 1:
            return samples.astype(np.float32, copy=False)
        x_old = np.linspace(0.0, duration, num=len(samples), endpoint=False)
        x_new = np.linspace(0.0, duration, num=target_len, endpoint=False)
        return np.interp(x_new, x_old, samples).astype(np.float32, copy=False)


_TOKEN_KEEP = re.compile(r"[^a-z' ]+")
_WS = re.compile(r"\s+")
_PUNCT = {".", ",", "!", "?", ";", ":"}


def _clean_for_ctc(text: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace — CTC vocab friendly."""
    t = text.lower()
    t = _TOKEN_KEEP.sub(" ", t)
    t = _WS.sub(" ", t).strip()
    return t


def _calibrate_to_100(mean_log_prob: float) -> float:
    """Map a mean per-token log-probability to a 0–100 score.

    Empirically, "good" English on wav2vec2-base-960h lands near -2.0 nats
    and "garbled" near -6.0 nats. We linearly interpolate that range to
    90 → 30 (so a great run doesn't peg 100, and a bad run still gets some
    signal). Anything worse than -7 nats is treated as 0; anything better
    than -1 nat is treated as 100.
    """
    if math.isnan(mean_log_prob):
        return 0.0
    best, worst = -1.0, -7.0
    if mean_log_prob >= best:
        return 100.0
    if mean_log_prob <= worst:
        return 0.0
    # Map worst→30, best→90, so 100 is reserved for future fine-tuned models.
    score = 30.0 + (mean_log_prob - worst) * (90.0 - 30.0) / (best - worst)
    return float(score)
