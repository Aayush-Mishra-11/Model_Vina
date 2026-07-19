"""Grammar Error Correction (GEC) via vennify/t5-base-grammar-correction.

The model is a T5-base (~250 MB) fine-tuned on the CoLA / Lang-8 / cLang-8
corpora to fix grammatical errors without rewriting meaning — distinct from
the LLM-based rewrites in `llm.py` which can rephrase freely.

Public API
----------
* `correct_grammar(text)` — returns a single string, or None on failure.
* `is_available()` — True if the model + tokenizer are loaded.
* `last_load_error()` — last load-time exception message, for diagnostics.
* `variant_prompts()` — alternative instructions the model responds well to
  (improved, professional). Each one wraps the input as a T5 prefix.

Failure modes
-------------
* `transformers` not installed / model cache missing → `correct_grammar`
  returns None. The pipeline falls back to the LLM call.
* Any inference exception → None.
* Empty / whitespace-only text → None.
"""

from __future__ import annotations

import logging
import os
import threading
from typing import List, Optional

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_model = None
_tokenizer = None
_load_attempted = False
_load_error: Optional[str] = None

MODEL_ID = os.getenv("GEC_MODEL", "vennify/t5-base-grammar-correction")

# T5 prefix the vennify model was fine-tuned with.
PREFIX_GE = "gec: "


# ----------------------------------------------------------------------
# Public API
# ----------------------------------------------------------------------

def is_available() -> bool:
    """True if the GEC model has loaded successfully."""
    _ensure_loaded()
    return _model is not None and _tokenizer is not None


def last_load_error() -> Optional[str]:
    _ensure_loaded()
    return _load_error


def correct_grammar(text: str, max_length: int = 256) -> Optional[str]:
    """Return a grammar-corrected version of `text`, or None on failure.

    The model only rephrases to fix grammar; it does not rewrite meaning
    the way a chat-tuned LLM does. The pipeline uses this in addition to
    the LLM rewrite so the `corrected` field is a true GEC, not a free
    rewrite.
    """
    if not text or not text.strip():
        return None
    _ensure_loaded()
    if _model is None or _tokenizer is None:
        return None

    try:
        import torch  # local import to keep module import cheap

        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = _model.to(device) if hasattr(_model, "to") else _model

        input_text = PREFIX_GE + text.strip()
        enc = _tokenizer(
            [input_text],
            return_tensors="pt",
            truncation=True,
            max_length=max_length,
        )
        enc = {k: v.to(device) for k, v in enc.items()}
        with torch.no_grad():
            out = model.generate(
                **enc,
                max_length=max_length,
                num_beams=4,
                early_stopping=True,
            )
        corrected = _tokenizer.decode(out[0], skip_special_tokens=True).strip()
        return corrected or None
    except Exception as exc:
        logger.warning("gec: inference failed: %s", exc)
        return None


def variant_prompts() -> dict:
    """T5-style prompts the GEC model responds well to.

    Returns a dict of variant_key -> input string. Use `correct_grammar`
    directly if you only need the base correction.
    """
    return {
        "gec": PREFIX_GE,
    }


# ----------------------------------------------------------------------
# Internal helpers
# ----------------------------------------------------------------------

def _ensure_loaded() -> None:
    """Lazy, thread-safe model + tokenizer load."""
    global _model, _tokenizer, _load_attempted, _load_error
    if _load_attempted:
        return
    with _lock:
        if _load_attempted:
            return
        _load_attempted = True
        try:
            from transformers import T5ForConditionalGeneration, T5Tokenizer

            # If we already have the model cached locally, prefer offline mode
            # (avoids "getaddrinfo failed" when the network is flaky).
            try:
                from huggingface_hub import try_to_load_from_cache
                cached = try_to_load_from_cache(MODEL_ID, "config.json")
                if cached is not None and cached != "_not_found_":
                    os.environ.setdefault("HF_HUB_OFFLINE", "1")
                    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
            except Exception:
                pass

            _tokenizer = T5Tokenizer.from_pretrained(MODEL_ID)
            _model = T5ForConditionalGeneration.from_pretrained(MODEL_ID)
            _model.eval()
            _load_error = None
            logger.info("gec: loaded %s", MODEL_ID)
        except Exception as exc:
            _model = None
            _tokenizer = None
            _load_error = str(exc)
            logger.warning("gec: model load failed: %s", exc)
