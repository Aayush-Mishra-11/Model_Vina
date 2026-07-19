"""Conversation pipeline — STT + analytics + LLM correction + grammar check.

Public entry points:
  * `process_audio_session(bytes)` — full pipeline for an audio blob.
  * `process_text_session(str)` — text-only path used by some legacy routes.
  * `build_correction_result(str)` — 4-variant `CorrectionResult` for /correction.
"""

import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

try:
    from server.converters.stt import transcribe_audio_full
    from server.llm import call_local_mistral
    from server.analytics import calculate_metrics, is_likely_english
    from server.services.wav2vec_pronunciation import (
        score_pronunciation as _wav2vec_score,
        is_available as _wav2vec_available,
    )
    from server.services.gec_corrector import (
        correct_grammar as _gec_correct,
        is_available as _gec_available,
    )
    from server.services import rag_coaching as _rag
except ModuleNotFoundError:
    from converters.stt import transcribe_audio_full
    from llm import call_local_mistral
    from analytics import calculate_metrics, is_likely_english
    from services.wav2vec_pronunciation import (
        score_pronunciation as _wav2vec_score,
        is_available as _wav2vec_available,
    )
    from services.gec_corrector import (
        correct_grammar as _gec_correct,
        is_available as _gec_available,
    )
    from services import rag_coaching as _rag


# ---------------------------------------------------------------------------
# Grammar checking
# ---------------------------------------------------------------------------
# We try language_tool_python first (3000+ real rules, runs locally). If the
# package is not installed or Java is missing, we fall back to a light diff
# approach so the UI never breaks.

_lt_tool = None
_lt_init_attempted = False


def _get_language_tool():
    """Lazy-load LanguageTool. Returns the tool instance or None on failure."""
    global _lt_tool, _lt_init_attempted
    if _lt_init_attempted:
        return _lt_tool
    _lt_init_attempted = True
    try:
        import language_tool_python  # type: ignore

        _lt_tool = language_tool_python.LanguageTool("en-US")
    except Exception:
        # Either package missing or Java runtime not available.
        _lt_tool = None
    return _lt_tool


def _grammar_errors_with_languagetool(text: str) -> List[Dict[str, Any]]:
    tool = _get_language_tool()
    if tool is None or not text or not text.strip():
        return []
    try:
        matches = tool.check(text)
    except Exception:
        return []
    errors: List[Dict[str, Any]] = []
    for idx, m in enumerate(matches[:20]):  # cap to keep response small
        suggestion = m.replacements[0] if m.replacements else ""
        category = (m.category or "grammar").lower()
        # Coarse map → frontend GrammarError.category union
        if category not in {"grammar", "spelling", "punctuation", "style"}:
            category = "grammar"
        errors.append(
            {
                "id": f"g{idx + 1}",
                "message": m.message or "Grammar issue",
                "category": category,
                "start": int(m.offset),
                "end": int(m.offset + m.errorLength),
                "suggestion": suggestion,
            }
        )
    return errors


def _fallback_grammar_errors(original: str, corrected: str) -> List[Dict[str, Any]]:
    """Cheap fallback: one suggestion when the LLM rewrote anything."""
    if not original or not corrected or original.strip() == corrected.strip():
        return []
    return [
        {
            "id": "g1",
            "message": "Suggested rewrite for clearer grammar and flow.",
            "category": "grammar",
            "start": 0,
            "end": len(original),
            "suggestion": corrected,
        }
    ]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _pace_to_int(pace_str: str) -> int:
    """Parse a "132 wpm" string into the integer 132 (defaults to 0)."""
    try:
        return int(str(pace_str).split()[0])
    except (ValueError, IndexError):
        return 0


def _build_correction_variants(
    text: str,
    base_corrected: str,
    user_id: Optional[str] = None,
) -> Dict[str, str]:
    """Produce `corrected`, `improved`, and `professional` variants for a piece of text.

    The `corrected` field prefers the dedicated GEC model (T5 fine-tuned on
    grammar error correction) when it's available. If not, we use
    `base_corrected` (the LLM rewrite) as a graceful fallback.

    `improved` and `professional` always come from the LLM. When a
    `user_id` is provided we feed the LLM the user's RAG context so the
    rewrite references past mistakes.
    """
    rag_ctx = _rag.coaching_context(user_id, text) if user_id else ""

    if is_likely_english(text):
        # GEC-only pass (prefers high-quality LLM grammar check, falls back to local GEC)
        gec_output: Optional[str] = None
        if text.strip():
            grammar_prompt = (
                "You are an English grammar expert. Correct all grammatical, spelling, and punctuation errors in the following sentence. "
                "Keep the original words and sentence structure as much as possible, only correcting what is wrong. "
                f"Original: \"{text}\" Return only the corrected sentence without explanation or quotes."
            )
            gec_output = call_local_mistral(grammar_prompt)
            if not gec_output:
                gec_output = _gec_correct(text)
        corrected = (gec_output or base_corrected or text).strip()

        rag_block = f"\n\nHere are the user's recent corrections for context — use them to make the rewrite consistent with their progress:\n{rag_ctx}" if rag_ctx else ""

        improved_prompt = (
            "You are a native English teacher. Rewrite the following sentence to make it sound natural, fluent, and idiomatic. "
            "Remove any awkward phrasing and spelling errors, but keep the original meaning. "
            f"Original sentence: \"{corrected}\" Return only the rewritten sentence without explanation or quotes."
            f"{rag_block}"
        )
        improved = call_local_mistral(improved_prompt) or corrected

        professional_prompt = (
            "You are a professional business coach. Rewrite the following sentence in a professional, formal business register "
            "suitable for a corporate meeting, workplace email, or interview. Keep the original meaning. "
            f"Sentence: \"{corrected}\" Return only the rewritten sentence without explanation or quotes."
            f"{rag_block}"
        )
        professional = call_local_mistral(professional_prompt) or corrected
    else:
        corrected = base_corrected
        improved = base_corrected
        professional = base_corrected

    return {
        "corrected": corrected,
        "improved": improved,
        "professional": professional,
    }


def _derive_grammar_errors(original: str, corrected: str) -> List[Dict[str, Any]]:
    """Real grammar errors when LanguageTool is available; fallback otherwise."""
    errors = _grammar_errors_with_languagetool(original)
    if errors:
        return errors
    return _fallback_grammar_errors(original, corrected)


def _derive_vocab_suggestions(text: str) -> List[Dict[str, Any]]:
    """Suggest richer alternatives for a couple of common weak words."""
    if not text:
        return []
    lower = text.lower()
    suggestions: List[Dict[str, Any]] = []
    for weak, meaning, alts in [
        ("good", "A basic positive adjective.", ["excellent", "solid", "impressive"]),
        ("bad", "A basic negative adjective.", ["poor", "unfortunate", "subpar"]),
        ("nice", "A vague positive adjective.", ["pleasant", "delightful", "wonderful"]),
        ("very", "An intensifier that weakens writing.", ["extremely", "remarkably", "exceptionally"]),
    ]:
        if f" {weak} " in f" {lower} ":
            suggestions.append({"word": weak, "meaning": meaning, "alternatives": alts})
    return suggestions[:3]


def _build_practice_result(
    session_id: str,
    transcript: str,
    corrected_text: str,
    metrics: Dict[str, Any],
    language_alert: Optional[str],
    pronunciation_score: Optional[int] = None,
) -> Dict[str, Any]:
    """Map the pipeline output into the frontend's `PracticeResult` shape.

    If `pronunciation_score` is provided (from Wav2Vec2), use it. Otherwise
    fall back to the legacy heuristic: confidenceScore + 8, clamped 40-99.
    """
    if pronunciation_score is None:
        pronunciation_score = max(
            40,
            min(99, int(metrics.get("confidenceScore", 0)) + 8),
        )
    return {
        "id": session_id,
        "transcript": transcript,
        "corrected": corrected_text,
        "grammarErrors": _derive_grammar_errors(transcript, corrected_text),
        "vocabularySuggestions": _derive_vocab_suggestions(transcript),
        "confidenceScore": int(metrics.get("confidenceScore", 0)),
        "pronunciationScore": pronunciation_score,
        "pronunciationAvailable": pronunciation_score is not None,
        "speakingPaceWpm": _pace_to_int(metrics.get("estimatedPace", "0 wpm")),
        "englishOnlyViolation": bool(language_alert),
    }


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------

def process_audio_session(
    audio_bytes: bytes,
    user_id: Optional[str] = None,
    session_type: str = "free_practice",
    session_id: Optional[str] = None,
    created_at: Optional[str] = None,
) -> Dict[str, Any]:
    """Run STT + analytics + LLM correction on a recorded audio blob.

    Returns a dict containing the original `transcript` / `correctedText` /
    `metrics` / `languageAlert` / `ttsAudio` for the legacy endpoints,
    PLUS the frontend-shaped `result` (a `PracticeResult`-compatible dict).

    When `user_id` is provided the result is also stored in the RAG
    vector store and the LLM rewrite uses past sessions as context.
    """
    transcription = transcribe_audio_full(audio_bytes)
    transcript = transcription.text
    metrics = calculate_metrics(
        transcript,
        duration_seconds=transcription.duration,
        speech_duration_seconds=transcription.speech_duration,
        pause_count=transcription.pause_count,
    )
    language_alert = None
    corrected_text = ''
    rag_ctx = _rag.coaching_context(user_id, transcript) if user_id else ""

    if not is_likely_english(transcript):
        language_alert = 'Language other than English detected, please talk in English.'
        corrected_text = 'Language other than English detected, please talk in English.'
    else:
        # 1. GEC model: dedicated grammar-only correction. Preserves meaning.
        gec_text = _gec_correct(transcript) if transcript.strip() else None
        # 2. LLM rewrite: smoother, more natural prose. The pipeline's
        #    `corrected` field favors the LLM output when the LLM succeeds,
        #    but falls back to the GEC if the LLM is offline.
        rag_block = (
            "\n\nThe user has practiced these phrases recently. Reference any recurring "
            "mistakes in your rewrite or feedback:\n" + rag_ctx
        ) if rag_ctx else ""
        prompt = (
            'Please improve the following spoken English for a professional, confident response. '
            'Correct grammar, remove filler words, enhance vocabulary, and preserve the meaning. '
            f'Original: "{transcript}" Return only the corrected and improved text without explanation.'
            f'{rag_block}'
        )
        llm_text = call_local_mistral(prompt)
        corrected_text = (llm_text or gec_text or transcript).strip()

    # Real phoneme-level pronunciation score from Wav2Vec2 — only when we
    # actually have a usable English transcript to align against. Falls
    # back to the legacy heuristic inside _build_practice_result.
    pronunciation_score: Optional[int] = None
    if not language_alert and transcript.strip():
        try:
            pronunciation_score = _wav2vec_score(
                audio_bytes,
                transcript,
                audio_duration=transcription.duration,
            )
        except Exception:
            pronunciation_score = None

    result = _build_practice_result(
        session_id=session_id or (transcript[:8] or 'audio'),
        transcript=transcript,
        corrected_text=corrected_text,
        metrics=metrics,
        language_alert=language_alert,
        pronunciation_score=pronunciation_score,
    )

    # Persist to RAG so future sessions can use this as context.
    if user_id and (transcript or corrected_text):
        try:
            from datetime import datetime, timezone
            _rag.store_session(
                user_id=user_id,
                session_id=result["id"],
                session_type=session_type,
                transcript=transcript,
                corrected=corrected_text or transcript,
                metrics={
                    "confidenceScore": result["confidenceScore"],
                    "pronunciationScore": result["pronunciationScore"],
                    "speakingPaceWpm": result["speakingPaceWpm"],
                    "wordsSpoken": int(metrics.get("wordsSpoken", 0) or 0),
                    "durationSeconds": int(metrics.get("durationSeconds", 0) or 0),
                },
                created_at=created_at or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            )
        except Exception as exc:
            logger = __import__("logging").getLogger(__name__)
            logger.warning("rag: store failed: %s", exc)

    return {
        'transcript': transcript,
        'correctedText': corrected_text,
        'metrics': metrics,
        'languageAlert': language_alert,
        'pronunciationAvailable': bool(pronunciation_score is not None),
        'result': result,
    }


def process_text_session(text: str) -> Dict[str, Any]:
    metrics = calculate_metrics(text)
    language_alert = None
    corrected_text = ''

    if not is_likely_english(text):
        language_alert = 'Please use only English in this practice session.'
        base = text
    else:
        prompt = (
            'Please improve the following spoken English for a professional, confident response. '
            'Correct grammar, remove filler words, enhance vocabulary, and preserve the meaning. '
            f'Original: "{text}" Return only the corrected and improved text without explanation.'
        )
        corrected_text = call_local_mistral(prompt)
        base = corrected_text or text

    return {
        'correctedText': corrected_text,
        'metrics': metrics,
        'languageAlert': language_alert,
    }


def build_correction_result(text: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    """Build a frontend-shaped `CorrectionResult` for the /correction endpoint."""
    metrics = calculate_metrics(text)
    language_alert = None

    if not is_likely_english(text):
        language_alert = 'Please use only English in this practice session.'
        base_corrected = text.strip()
        variants = {
            "corrected": base_corrected,
            "improved": base_corrected,
            "professional": base_corrected,
        }
    else:
        # 1. GEC pass: grammar-only correction (preserves meaning).
        gec_text = _gec_correct(text) if text.strip() else None
        # 2. LLM pass: smoother / more natural prose.
        rag_ctx = _rag.coaching_context(user_id, text) if user_id else ""
        rag_block = (
            "\n\nThe user has practiced these phrases recently — use them for context:\n" + rag_ctx
        ) if rag_ctx else ""
        prompt = (
            'Please improve the following spoken English for a professional, confident response. '
            'Correct grammar, remove filler words, enhance vocabulary, and preserve the meaning. '
            f'Original: "{text}" Return only the corrected and improved text without explanation.'
            f'{rag_block}'
        )
        llm_text = call_local_mistral(prompt)
        base_corrected = (llm_text or gec_text or text).strip()
        variants = _build_correction_variants(text, base_corrected, user_id=user_id)

        # Persist to RAG so future /correction calls can reference it.
        if user_id and text.strip():
            try:
                from datetime import datetime, timezone
                _rag.store_session(
                    user_id=user_id,
                    session_id=f"corr_{abs(hash(text)) & 0xFFFFFFFF:08x}",
                    session_type="ai_correction",
                    transcript=text,
                    corrected=variants.get("corrected") or text,
                    metrics={
                        "confidenceScore": int(metrics.get("confidenceScore", 0) or 0),
                        "wordsSpoken": int(metrics.get("wordsSpoken", 0) or 0),
                    },
                    created_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                )
            except Exception as exc:
                logger.warning("rag: store failed: %s", exc)

    return {
        "id": text[:8] or "corr",
        "original": text,
        **variants,
        "grammarErrors": _derive_grammar_errors(text, variants["corrected"]),
        "vocabularySuggestions": _derive_vocab_suggestions(text),
    }
